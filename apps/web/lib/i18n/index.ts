import { ky } from './ky';
import { kySeller } from './kySeller';
import { Key, ru } from './ru';

export type { Key };
export type Locale = 'ru' | 'ky';

export const LOCALES: Locale[] = ['ru', 'ky'];
export const LOCALE_COOKIE = 'tapwear.locale';
export const localeNames: Record<Locale, string> = { ru: 'Русский', ky: 'Кыргызча' };

const dictionaries: Record<Locale, Record<Key, string>> = { ru, ky };

export function parseLocale(value: string | undefined | null): Locale {
  return value === 'ky' ? 'ky' : 'ru';
}

export type Translate = (key: Key, values?: Record<string, string | number>) => string;

// Returns the text for a key in the given language, filling {placeholders}.
export function translator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, values) => {
    const text = dictionary[key] ?? ru[key];
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  };
}

export type TranslateSource = (russian: string, values?: Record<string, string | number>) => string;

// Seller and moderation pages are written in Russian in the code; this returns the
// Kyrgyz text for a Russian source string (or the Russian itself), filling {placeholders}.
export function sourceTranslator(locale: Locale): TranslateSource {
  return (russian, values) => {
    const text = (locale === 'ky' ? kySeller[russian] : undefined) ?? russian;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  };
}

// For keys built at run time ("audience." + code): the key if it exists, else undefined.
export function optionalKey(key: string): Key | undefined {
  return key in ru ? (key as Key) : undefined;
}

const nouns = {
  product: { ru: ['товар', 'товара', 'товаров'], ky: 'товар' },
  store: { ru: ['магазин', 'магазина', 'магазинов'], ky: 'дүкөн' },
} as const;

// "21 товар", "22 товара", "25 товаров". Kyrgyz nouns do not change after a number.
export function countLabel(locale: Locale, count: number, noun: keyof typeof nouns): string {
  if (locale === 'ky') return `${count} ${nouns[noun].ky}`;
  const forms = nouns[noun].ru;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const form =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}
