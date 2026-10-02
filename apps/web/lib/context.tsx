'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as api from './api';
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  Locale,
  Translate,
  TranslateSource,
  countLabel,
  sourceTranslator,
  translator,
} from './i18n';
import { CatalogFilters, Me } from './types';

interface AppContextType {
  // Interface language, its translate function and a helper for "5 товаров".
  locale: Locale;
  t: Translate;
  // For seller and moderation pages: translates a Russian source string.
  tr: TranslateSource;
  count: (count: number, noun: 'product' | 'store') => string;
  setLocale: (locale: Locale) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
  // What the catalog contains (audiences, categories, sizes, stores); null if the API is down.
  catalog: CatalogFilters | null;
  // The signed-in account: undefined while it is being checked, null for a guest.
  me: Me | null | undefined;
  signIn: (email: string, password: string) => Promise<Me>;
  signUp: (email: string, password: string, name: string) => Promise<Me>;
  signOut: () => Promise<void>;
  setMe: (me: Me) => void;
  // Saved product ids: the account's list when signed in, otherwise this device's list.
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  // Products saved on this device as a guest that are not in the account yet.
  deviceOnlyFavorites: string[];
  // Adds them to the account and clears the device list.
  moveDeviceFavoritesToAccount: () => Promise<void>;
}

const FAVORITES_KEY = 'tapwear.favorites';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({
  children,
  catalog,
  locale,
  dark: initialDark,
}: {
  children: ReactNode;
  catalog: CatalogFilters | null;
  locale: Locale;
  dark: boolean;
}) {
  // Set during render, so that requests made by child effects already use it.
  api.setApiLocale(locale);
  const t = translator(locale);
  const tr = sourceTranslator(locale);

  const setLocale = (next: Locale) => {
    // Remembered for a year. The page is reloaded so that server-rendered parts
    // and names coming from the API switch language too.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  const [dark, setDarkState] = useState(initialDark);
  const setDark = (next: boolean) => {
    // Applied at once; the cookie makes the server render the same theme next time.
    document.documentElement.classList.toggle('dark', next);
    document.cookie = `${THEME_COOKIE}=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
    setDarkState(next);
  };

  const [me, setAccount] = useState<Me | null | undefined>(undefined);
  // A guest's list lives on the device (spec CAT07); an account's list lives on the server.
  const [deviceFavorites, setDeviceFavorites] = useState<string[]>([]);
  const [deviceLoaded, setDeviceLoaded] = useState(false);
  const [accountFavorites, setAccountFavorites] = useState<string[]>([]);

  // Storage can be unavailable (private mode), so the app must work without it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        setDeviceFavorites(saved.filter((id) => typeof id === 'string' && UUID.test(id)));
      }
    } catch {
      // Ignore unreadable storage and start with an empty list.
    }
    setDeviceLoaded(true);
  }, []);

  useEffect(() => {
    if (!deviceLoaded) return;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(deviceFavorites));
    } catch {
      // The list then lasts only for this visit.
    }
  }, [deviceFavorites, deviceLoaded]);

  const remember = (account: Me | null) => {
    api.setCsrfToken(account?.csrf_token ?? null);
    setAccount(account);
    if (account) {
      api
        .getFavoriteIds()
        .then((list) => setAccountFavorites(list.ids))
        .catch(() => setAccountFavorites([]));
    } else {
      setAccountFavorites([]);
    }
    return account;
  };

  // Ask the API who is signed in (the session lives in an HttpOnly cookie).
  useEffect(() => {
    api
      .getMe()
      .then(remember)
      .catch(() => remember(null));
  }, []);

  const signIn = async (email: string, password: string) =>
    remember(await api.login(email, password))!;
  const signUp = async (email: string, password: string, name: string) =>
    remember(await api.register(email, password, name))!;
  const signOut = async () => {
    await api.logout().catch(() => undefined);
    remember(null);
  };
  const setMe = (account: Me) => {
    api.setCsrfToken(account.csrf_token);
    setAccount(account);
  };

  const favorites = me ? accountFavorites : deviceFavorites;

  const toggleFavorite = (productId: string) => {
    const saved = favorites.includes(productId);
    if (!me) {
      setDeviceFavorites((current) =>
        saved ? current.filter((id) => id !== productId) : [productId, ...current]
      );
      return;
    }
    // Show the change at once, then take the server's list; undo if the request fails.
    const before = accountFavorites;
    setAccountFavorites(
      saved ? before.filter((id) => id !== productId) : [productId, ...before]
    );
    (saved ? api.removeFavorite(productId) : api.addFavorite(productId))
      .then((list) => setAccountFavorites(list.ids))
      .catch(() => setAccountFavorites(before));
  };

  const deviceOnlyFavorites = me
    ? deviceFavorites.filter((id) => !accountFavorites.includes(id))
    : [];

  const moveDeviceFavoritesToAccount = async () => {
    const list = await api.mergeFavorites(deviceFavorites);
    setAccountFavorites(list.ids);
    setDeviceFavorites([]);
  };

  return (
    <AppContext.Provider
      value={{
        locale,
        t,
        tr,
        count: (count, noun) => countLabel(locale, count, noun),
        setLocale,
        dark,
        setDark,
        catalog,
        me,
        signIn,
        signUp,
        signOut,
        setMe,
        favorites,
        toggleFavorite,
        isFavorite: (productId) => favorites.includes(productId),
        deviceOnlyFavorites,
        moveDeviceFavoritesToAccount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
