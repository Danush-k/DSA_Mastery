import { create } from 'zustand';

export const useGoogleAuthStore = create((set) => ({
  accessToken: null,
  isAuthorized: false,
  setAccessToken: (token) => set({ accessToken: token, isAuthorized: !!token }),
  logout: () => set({ accessToken: null, isAuthorized: false }),
}));
