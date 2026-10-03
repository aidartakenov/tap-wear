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
import { CartItem, CatalogFilters, Me } from './types';

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
  // After the account was deleted on the server: forget it here without calling the API.
  forgetAccount: () => void;
  setMe: (me: Me) => void;
  // What the buyer is about to order. It lives on this device until checkout.
  cart: CartItem[];
  cartCount: number;
  addToCart: (variantId: string, quantity?: number) => void;
  setCartQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantIds: string[]) => void;
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
const CART_KEY = 'tapwear.cart';
// The API accepts at most this many pieces of one size and colour.
const MAX_PER_LINE = 10;
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

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        setCart(
          saved.filter(
            (item) => typeof item?.variantId === 'string' && Number.isInteger(item?.quantity)
          )
        );
      }
    } catch {
      // Unreadable storage: start with an empty cart.
    }
    setCartLoaded(true);
  }, []);
  useEffect(() => {
    // Not before the saved cart was read, or it would be overwritten with an empty one.
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Private mode: the cart then lasts until the tab is closed.
    }
  }, [cart, cartLoaded]);

  const clamp = (quantity: number) => Math.max(1, Math.min(MAX_PER_LINE, quantity));
  const addToCart = (variantId: string, quantity = 1) =>
    setCart((current) =>
      current.some((item) => item.variantId === variantId)
        ? current.map((item) =>
            item.variantId === variantId
              ? { ...item, quantity: clamp(item.quantity + quantity) }
              : item
          )
        : [...current, { variantId, quantity: clamp(quantity) }]
    );
  const setCartQuantity = (variantId: string, quantity: number) =>
    setCart((current) =>
      current.map((item) =>
        item.variantId === variantId ? { ...item, quantity: clamp(quantity) } : item
      )
    );
  const removeFromCart = (variantIds: string[]) =>
    setCart((current) => current.filter((item) => !variantIds.includes(item.variantId)));

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
        forgetAccount: () => remember(null),
        setMe,
        cart,
        cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        addToCart,
        setCartQuantity,
        removeFromCart,
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
