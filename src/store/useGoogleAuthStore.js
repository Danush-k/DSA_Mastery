import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useGoogleAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      expiresAt: null,
      isAuthorized: false,

      setAccessToken: (token) => {
        const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now
        set({ accessToken: token, expiresAt, isAuthorized: !!token });
      },

      logout: () => set({ accessToken: null, expiresAt: null, isAuthorized: false }),

      checkExpiry: () => {
        const state = get();
        if (state.expiresAt && Date.now() >= state.expiresAt) {
          set({ accessToken: null, expiresAt: null, isAuthorized: false });
          return true; // expired
        }
        return !state.accessToken; // returns true if no token
      }
    }),
    { name: 'dsa-google-auth-v1' }
  )
);
