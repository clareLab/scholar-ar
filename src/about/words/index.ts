import { en, type Words } from "./en.ts";
import { zh } from "./zh.ts";

export type { Words };

export const words = { en, zh };

export type Lang = keyof typeof words;

export const langs = Object.keys(words) as Lang[];
