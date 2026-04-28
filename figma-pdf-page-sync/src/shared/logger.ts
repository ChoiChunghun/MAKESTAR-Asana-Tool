import type { LogEntry, LogLevel } from "./types";

export function createLogEntry(message: string, level: LogLevel = "info"): LogEntry {
  return {
    level,
    message,
    time: new Date().toLocaleTimeString()
  };
}

export function writeConsoleLog(message: string, level: LogLevel = "info", details?: unknown): LogEntry {
  const entry = createLogEntry(message, level);
  if (level === "error") {
    console.error(message, details || "");
  } else if (level === "warn") {
    console.warn(message, details || "");
  } else {
    console.log(message, details || "");
  }
  return entry;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
