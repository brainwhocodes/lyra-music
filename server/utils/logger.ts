export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface Logger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}
interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}
const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const nativeConsole: Console = globalThis.console;
const currentLevel: LogLevel = parseLogLevel(process.env.LOG_LEVEL) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
function parseLogLevel(value?: string | null): LogLevel | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') return normalized as LogLevel;
  return null;
}
function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}
function toMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function serializeMetadataValue(value: unknown): unknown {
  if (value instanceof Error) return { error: value.message, stack: value.stack };
  return value;
}
function toMetadata(parts: unknown[]): Record<string, unknown> | undefined {
  if (parts.length === 0) return undefined;
  if (parts.length === 1 && parts[0] instanceof Error) return { error: parts[0].message, stack: parts[0].stack };
  return { data: parts.map(item => serializeMetadataValue(item)) };
}
function createPayload(level: LogLevel, args: unknown[]): LogPayload {
  const [first, ...rest] = args;
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message: toMessage(first ?? ''),
  };
  const metadata = toMetadata(rest);
  if (metadata) payload.metadata = metadata;
  return payload;
}
function writePayload(payload: LogPayload): void {
  const prefix = `${payload.timestamp} [${payload.level.toUpperCase()}] ${payload.message}`.trim();
  if (payload.level === 'error') {
    if (payload.metadata) nativeConsole.error(prefix, payload.metadata);
    else nativeConsole.error(prefix);
    return;
  }
  if (payload.level === 'warn') {
    if (payload.metadata) nativeConsole.warn(prefix, payload.metadata);
    else nativeConsole.warn(prefix);
    return;
  }
  if (payload.level === 'debug') {
    if (payload.metadata) nativeConsole.debug(prefix, payload.metadata);
    else nativeConsole.debug(prefix);
    return;
  }
  if (payload.metadata) nativeConsole.info(prefix, payload.metadata);
  else nativeConsole.info(prefix);
}
function emit(level: LogLevel, args: unknown[]): void {
  if (!shouldLog(level)) return;
  const payload = createPayload(level, args);
  writePayload(payload);
}
export const logger: Logger = {
  log: (...args: unknown[]) => emit('info', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
  debug: (...args: unknown[]) => emit('debug', args),
};
let consolePatched = false;
/**
 * Replaces the global console methods with the shared logger while preserving other console APIs.
 */
export function patchConsole(): void {
  if (consolePatched) return;
  const originalConsole: Console = globalThis.console;
  const patchedConsole: Console = { ...originalConsole } as Console;
  patchedConsole.log = (...args: unknown[]) => logger.info(...args);
  patchedConsole.info = (...args: unknown[]) => logger.info(...args);
  patchedConsole.warn = (...args: unknown[]) => logger.warn(...args);
  patchedConsole.error = (...args: unknown[]) => logger.error(...args);
  patchedConsole.debug = (...args: unknown[]) => logger.debug(...args);
  globalThis.console = patchedConsole;
  consolePatched = true;
}
