type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): Level {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return "info";
}

function shouldLog(level: Level): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

function silent(): boolean {
  return process.env.LOG_SILENT === "1" || process.env.NODE_ENV === "test";
}

function emit(level: Level, msg: string, meta?: unknown): void {
  if (silent() || !shouldLog(level)) return;
  const line = meta === undefined ? msg : `${msg} ${JSON.stringify(meta)}`;
  if (level === "error" || level === "warn") {
    console.error(`[${level}] ${line}`);
  } else {
    console.log(`[${level}] ${line}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
