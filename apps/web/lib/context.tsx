'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as api from './api';
import { AppState, CatalogFilters, Me } from './types';

interface AppContextType {
  state: AppState;
  // What the catalog contains (audiences, categories, sizes, stores); null if the API is down.
  catalog: CatalogFilters | null;
  // The signed-in account: undefined while it is being checked, null for a guest.
  me: Me | null | undefined;
  signIn: (email: string, password: string) => Promise<Me>;
  signUp: (email: string, password: string, name: string) => Promise<Me>;
  signOut: () => Promise<void>;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

const FAVORITES_KEY = 'topwear.favorites';

const defaultState: AppState = {
  favorites: [],
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AppProvider({
  children,
  catalog,
}: {
  children: ReactNode;
  catalog: CatalogFilters | null;
}) {
  const [state, setState] = useState<AppState>(defaultState);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const remember = (account: Me | null) => {
    api.setCsrfToken(account?.csrf_token ?? null);
    setMe(account);
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

  // Guest favorites are kept on the device (spec CAT07). Storage can be
  // unavailable (private mode), so the app must work without it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        setState((prev) => ({ ...prev, favorites: saved.filter((id) => typeof id === 'string' && UUID.test(id)) }));
      }
    } catch {
      // Ignore unreadable storage and start with an empty list.
    }
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
    } catch {
      // Favorites then last only for this visit.
    }
  }, [state.favorites, favoritesLoaded]);

  const toggleFavorite = (productId: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(productId)
        ? prev.favorites.filter((id) => id !== productId)
        : [...prev.favorites, productId],
    }));
  };

  const isFavorite = (productId: string) => {
    return state.favorites.includes(productId);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        catalog,
        me,
        signIn,
        signUp,
        signOut,
        toggleFavorite,
        isFavorite,
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
