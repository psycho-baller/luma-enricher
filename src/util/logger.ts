import pino, { type Logger, type LoggerOptions } from "pino";

export type LogLevelMode = {
  verbose?: boolean | undefined;
  quiet?: boolean | undefined;
  jsonLogs?: boolean | undefined;
};

const REDACT_PATHS = [
  "*.cookie",
  "*.cookies",
  "*.token",
  "*.session",
  "*.session_key",
  "*.email",
  "*.phone_number",
  "req.headers.cookie",
  "headers.cookie",
];

export function createLogger(options: LogLevelMode = {}): Logger {
  const level = options.quiet ? "error" : options.verbose ? "debug" : "info";
  const loggerOptions: LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: "[redacted]",
    },
  };
  if (!options.jsonLogs) {
    loggerOptions.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    };
  }
  return pino(loggerOptions);
}
