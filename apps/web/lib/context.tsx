'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, UserRole } from './types';

interface AppContextType {
  state: AppState;
  setUserRole: (role: UserRole) => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

const FAVORITES_KEY = 'topwear.favorites';

const defaultState: AppState = {
  favorites: [],
  userRole: 'guest',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Guest favorites are kept on the device (spec CAT07). Storage can be
  // unavailable (private mode), so the app must work without it.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      if (Array.isArray(saved)) {
        setState((prev) => ({ ...prev, favorites: saved.filter((id) => typeof id === 'string') }));
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

  const setUserRole = (role: UserRole) => {
    setState((prev) => ({ ...prev, userRole: role }));
  };

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
        setUserRole,
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
