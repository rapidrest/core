///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import winston from "winston";
const { format, transports } = winston;
const { combine, timestamp, printf } = format;
const logFormat = printf((info: any) => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
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
        format: combine(format.splat(), format.simple(), format.colorize(), timestamp(), logFormat),
        transports: transport,
    });

    _loggerCache.set(cacheKey, logger);
    return logger;
};
