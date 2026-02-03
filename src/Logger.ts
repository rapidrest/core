///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
const winston = require("winston");
const { format, transports } = winston;
const { combine, timestamp, printf } = format;
const logFormat = printf((info: any) => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
});

/**
 * Creates a new logger with the specified level and file name to output logs to.
 *
 * @param level The logging level to create the logger with.
 * @param file The name (without an extension) of the file to output logs to.
 */
export const Logger: any = function(level: string = "debug", file: string | undefined = undefined) {
    const transport: any[] = [new transports.Console()];
    if (file) {
        transport.push(new winston.transports.File({ filename: file + "error.log", level: "error" }));
        transport.push(new winston.transports.File({ filename: file + ".log" }));
    }

    return winston.createLogger({
        level,
        format: combine(format.splat(), format.simple(), format.colorize(), timestamp(), logFormat),
        transports: transport,
    });
};
