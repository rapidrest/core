///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { fileURLToPath } from "url";
import winston from "winston";
const { format, transports } = winston;
const { combine, timestamp, printf } = format;
export const FILENAME = fileURLToPath(import.meta.url).replace(/\\/g, "/");

// The default stack trace limit (10) is too shallow once a few frames of winston/logform internals are on the
// stack, causing the real caller frame that `source()` below looks for to be truncated. Widen it so the caller is
// always captured.
Error.stackTraceLimit = Math.max(Error.stackTraceLimit, 30);
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
    const stack = new Error().stack?.split("\n") ?? [];
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
        return _loggerCache.get(cacheKey);
    }

    const transport: any[] = [new transports.Console()];
    if (file) {
        transport.push(new winston.transports.File({ filename: file + "error.log", level: "error" }));
        transport.push(new winston.transports.File({ filename: file + ".log" }));
    }

    const logger = winston.createLogger({
        level,
        format: combine(format.splat(), format.simple(), format.colorize(), timestamp(), source(), logFormat),
        transports: transport,
    });

    _loggerCache.set(cacheKey, logger);
    return logger;
};
