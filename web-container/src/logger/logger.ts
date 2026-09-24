export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  child(scope: string): Logger;
}

const CONSOLE_WRITERS: Record<LogLevel, (...data: unknown[]) => void> = {
  debug: (...data) => console.debug(...data),
  info: (...data) => console.info(...data),
  warn: (...data) => console.warn(...data),
  error: (...data) => console.error(...data),
};

export function createLogger(scope = 'app', minLevel: LogLevel = 'debug'): Logger {
  const write = (level: LogLevel, message: string, context?: unknown) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
      return;
    }
    const scopedMessage = `[${scope}] ${message}`;
    if (context === undefined) {
      CONSOLE_WRITERS[level](scopedMessage);
    } else {
      CONSOLE_WRITERS[level](scopedMessage, context);
    }
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
    child: (childScope) => createLogger(`${scope}:${childScope}`, minLevel),
  };
}
