export const supportedUserLocales = ["en", "pt-BR"] as const;

export type UserLocale = (typeof supportedUserLocales)[number];

export function isUserLocale(value: unknown): value is UserLocale {
  return value === "en" || value === "pt-BR";
}
