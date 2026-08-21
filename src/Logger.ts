///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { fileURLToPath } from "url";
import winston from "winston";
import { CacheUtils } from "./CacheUtils.js";
const { format, transports } = winston;
const { combine, timestamp, printf } = format;
export const FILENAME = fileURLToPath(import.meta.url).replace(/\\/g, "/");

export const logFormat = printf((info: any) => {
    const prefix = info.source ? `[${info.source}] ` : "";
    return `${prefix}${info.timestamp} ${info.level}: ${info.message}`;
});

/**
 * Custom winston format that determines the class and/or method that issued the log statement and attaches it to
 * the log info as `source` (e.g. `MyClass.methodName`).
 *
 * When the logger was obtained via a child logger bound to an object's `_fqn` (see `ObjectFactory`), the fully
 * qualified name takes precedence over the class name so that e.g. `com.example.MyClass.methodName` is used
 * instead of the bare `MyClass.methodName` derived from the call stack. The method name is still taken from the
 * call stack in either case.
 */
export const source = format((info: any) => {
    // The default stack trace limit (10) is too shallow once a few frames of winston/logform internals are on
    // the stack, causing the real caller frame below to be truncated. The limit is widened only for the duration
    // of this capture (rather than mutated globally for the whole process) so every other `Error` thrown
    // anywhere in the application doesn't pay the cost of a permanently-widened trace.
    const originalStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = Math.max(originalStackTraceLimit, 30);
    const stack = new Error().stack?.split("\n") ?? [];
    Error.stackTraceLimit = originalStackTraceLimit;
    for (const line of stack) {
        if (line.includes(FILENAME) || line.includes("node_modules") || line.includes("node:internal")) {
            continue;
        }
        const match = line.match(/at (?:new )?([^\s(]+)\s*\(/) ?? line.match(/at ([^\s(]+):\d+:\d+/);
        if (match) {
            if (info.fqn) {
                const dot = match[1].lastIndexOf(".");
                const methodName = dot >= 0 ? match[1].substring(dot + 1) : undefined;
                info.source = methodName ? `${info.fqn}.${methodName}` : info.fqn;
            } else {
                info.source = match[1];
            }
            break;
        }
    }
    return info;
});

/** Maximum number of distinct `${level}:${file}` logger instances to keep cached. Each `file`-bound entry holds
 * open file descriptors via winston's `File` transport, so an unbounded cache would leak descriptors indefinitely
 * for any caller that varies `file` per call (e.g. a per-request or per-session name) instead of reusing a fixed
 * small set of names. */
const MAX_CACHED_LOGGERS = 100;

const _loggerCache: Map<string, any> = new Map();

/**
 * Creates (or retrieves a cached) logger with the specified level and file name to output logs to.
 *
 * @param level The logging level to create the logger with.
 * @param file The name (without an extension) of the file to output logs to.
 */
export const Logger: any = function(level: string = "debug", file: string | undefined = undefined) {
    const cacheKey = `${level}:${file ?? ""}`;
    if (_loggerCache.has(cacheKey)) {
        const cached = _loggerCache.get(cacheKey);
        // Move to the end of the Map's iteration order so a frequently-reused logger isn't evicted (and its
        // file transport closed, possibly mid-write) ahead of one that's actually gone idle - Map.set() on an
        // already-present key doesn't reorder it by itself.
        _loggerCache.delete(cacheKey);
        _loggerCache.set(cacheKey, cached);
        return cached;
    }

    // `colorize()` wraps `info.level` in ANSI escape codes unconditionally - it doesn't detect whether the
    // destination is a TTY. It must stay Console-only rather than living in the logger-level `format` below:
    // winston applies the logger-level format to every transport that doesn't supply its own override -
    // including the File transports, and any transport a caller adds later via `logger.add()` - so baking
    // colorize() into it would corrupt on-disk logs and any other attached transport with escape sequences that
    // break grep/log shippers/aggregators expecting a plain-text level field. The logger-level format is left as
    // the uncolored base precisely so those other transports still inherit sensible plain-text formatting.
    const base = combine(format.splat(), format.simple(), timestamp(), source(), logFormat);
    const transport: any[] = [new transports.Console({ format: combine(format.colorize(), base) })];
    if (file) {
        transport.push(new winston.transports.File({ filename: file + "error.log", level: "error" }));
        transport.push(new winston.transports.File({ filename: file + ".log" }));
    }

    const logger = winston.createLogger({
        level,
        format: base,
        transports: transport,
    });

    if (_loggerCache.size >= MAX_CACHED_LOGGERS) {
        // Non-null: the size check above guarantees the cache is non-empty, so `.next()` always yields a real key.
        const oldestKey = _loggerCache.keys().next().value!;
        const oldest = _loggerCache.get(oldestKey);
        CacheUtils.evictOldest(_loggerCache);
        // Close the evicted logger's transports so its file descriptors are actually released, not just
        // dropped from the cache while still held open by winston.
        oldest?.close?.();
    }
    _loggerCache.set(cacheKey, logger);
    return logger;
};
