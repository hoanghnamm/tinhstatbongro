// Web sign-in lasts for this tab. Native sessions live in SecureStore.
const KEY = 'hooprec-session';
export const SessionVault = {
  get: async (): Promise<string | null> => typeof window === 'undefined' ? null : window.sessionStorage.getItem(KEY),
  set: async (value: string): Promise<void> => { window.sessionStorage.setItem(KEY, value); },
  clear: async (): Promise<void> => { window.sessionStorage.removeItem(KEY); },
};
