'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppState, UserRole, FilterState } from './types';

interface AppContextType {
  state: AppState;
  setUserRole: (role: UserRole) => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  setFilter: (filter: Partial<FilterState>) => void;
}

const defaultFilter: FilterState = {
  category: 'Все',
  minPrice: 0,
  maxPrice: 20000,
  color: 'Все',
  size: '',
};

const defaultState: AppState = {
  favorites: [],
  cart: [],
  userRole: 'guest',
  filter: defaultFilter,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  const setUserRole = (role: UserRole) => {
    setState(prev => ({ ...prev, userRole: role }));
  };

  const toggleFavorite = (productId: string) => {
    setState(prev => ({
      ...prev,
      favorites: prev.favorites.includes(productId)
        ? prev.favorites.filter(id => id !== productId)
        : [...prev.favorites, productId],
    }));
  };

  const isFavorite = (productId: string) => {
    return state.favorites.includes(productId);
  };

  const setFilter = (filter: Partial<FilterState>) => {
    setState(prev => ({
      ...prev,
      filter: { ...prev.filter, ...filter },
    }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        setUserRole,
        toggleFavorite,
        isFavorite,
        setFilter,
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
