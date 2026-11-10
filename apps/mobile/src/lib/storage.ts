/**
 * Persistent token + preference storage for mobile.
 * Uses expo-secure-store for tokens (encrypted at rest) with an in-memory cache
 * so the synchronous HTTP client can read them without awaiting.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'mehfil.access';
const REFRESH_KEY = 'mehfil.refresh';
const LOCALE_KEY = 'mehfil.locale';

/* ------------------------------- Token cache ------------------------------ */

let cachedAccess: string | null = null;
let cachedRefresh: string | null = null;

export const tokenStore = {
  get access(): string | null {
    return cachedAccess;
  },
  get refresh(): string | null {
    return cachedRefresh;
  },
  /** Hydrate the in-memory cache from secure storage (call once at boot). */
  async load(): Promise<void> {
    try {
      const [a, r] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      cachedAccess = a;
      cachedRefresh = r;
    } catch {
      cachedAccess = null;
      cachedRefresh = null;
    }
  },
  async set(access: string, refresh: string): Promise<void> {
    cachedAccess = access;
    cachedRefresh = refresh;
    try {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_KEY, access),
        SecureStore.setItemAsync(REFRESH_KEY, refresh),
      ]);
    } catch {
      /* non-fatal: cache still valid for this session */
    }
  },
  async clear(): Promise<void> {
    cachedAccess = null;
    cachedRefresh = null;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
      ]);
    } catch {
      /* ignore */
    }
  },
};

/* --------------------------------- Locale --------------------------------- */

export async function loadLocale(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

export async function saveLocale(locale: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}
