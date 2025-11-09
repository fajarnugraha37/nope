export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  level: LogLevel;
  fields: LogContext;
  trace(message: string, fields?: LogContext): void;
  debug(message: string, fields?: LogContext): void;
  info(message: string, fields?: LogContext): void;
  warn(message: string, fields?: LogContext): void;
  error(message: string, fields?: LogContext): void;
  fatal(message: string, fields?: LogContext): void;
  child(extra: LogContext): Logger;
}

const severity: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  writer?: (entry: LogEntry) => void;
  fields?: LogContext;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  ts: string;
  fields: LogContext;
}

const defaultWriter = (entry: LogEntry) => {
  const line = JSON.stringify(entry);
  const fn = entry.level === "error" || entry.level === "fatal" ? console.error : console.log;
  fn(line);
};

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const writer = options.writer ?? defaultWriter;
  const baseFields: LogContext = options.name ? { logger: options.name, ...options.fields } : { ...options.fields };
  let currentLevel: LogLevel = options.level ?? "info";

  const log = (entryLevel: LogLevel, message: string, fields?: LogContext) => {
    if (severity[entryLevel] < severity[currentLevel]) {
      return;
    }

    writer({
      level: entryLevel,
      message,
      ts: new Date().toISOString(),
      fields: { ...baseFields, ...fields },
    });
  };

  const child = (extra: LogContext): Logger => {
    return createLogger({ ...options, fields: { ...baseFields, ...extra }, level: currentLevel });
  };

  return {
    get level() {
      return currentLevel;
    },
    set level(next) {
      currentLevel = next;
    },
    get fields() {
      return baseFields;
    },
    trace: (message, fields) => log("trace", message, fields),
    debug: (message, fields) => log("debug", message, fields),
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
    error: (message, fields) => log("error", message, fields),
    fatal: (message, fields) => log("fatal", message, fields),
    child,
  };
};
