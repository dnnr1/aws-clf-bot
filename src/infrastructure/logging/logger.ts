function getErrorDetails(error: unknown): {
  errorName: string;
  errorMessage: string;
} {
  if (!(error instanceof Error)) {
    return {
      errorName: "UnknownError",
      errorMessage: "An unknown error occurred.",
    };
  }

  const errorMessage = error.message
    .replace(/[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}/g, "[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1[REDACTED]@");

  return { errorName: error.name, errorMessage };
}

export const logger = {
  info(event: string, context: Record<string, string> = {}): void {
    console.info(JSON.stringify({ level: "info", event, ...context }));
  },
  error(
    event: string,
    error: unknown,
    context: Record<string, string> = {},
  ): void {
    console.error(
      JSON.stringify({
        level: "error",
        event,
        ...context,
        ...getErrorDetails(error),
      }),
    );
  },
};

export type Logger = typeof logger;
