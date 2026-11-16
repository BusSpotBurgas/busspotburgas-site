import "server-only";

export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bg";

const dictionaries = {
  bg: () => import("@/dictionaries/bg.json").then((m) => m.default),
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["bg"]>>;

export const hasLocale = (l: string): l is Locale =>
  (locales as readonly string[]).includes(l);

export const getDictionary = (l: Locale): Promise<Dictionary> => dictionaries[l]();
