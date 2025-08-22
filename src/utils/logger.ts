import { ErrorLog } from '../types';

export class Logger {
  private static instance: Logger;
  private debugMode = false;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  public log(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      console.log(`[LCPTracer] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    console.warn(`[LCPTracer] ${message}`, ...args);
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorLog: ErrorLog = {
      level: 'error',
      message: `[LCPTracer] ${message}`,
      error,
      context
    };

    console.error(errorLog.message, error);
    
    if (this.debugMode && context) {
      console.error('Error context:', context);
    }
  }

  public debug(message: string, data?: unknown): void {
    if (this.debugMode) {
      console.debug(`[LCPTracer DEBUG] ${message}`, data !== undefined ? data : '');
    }
  }
}