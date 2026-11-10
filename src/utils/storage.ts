type StorageValue = string | null;

export const safeStorage = {
  getItem(key: string): StorageValue {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage quota / privacy errors; app must remain functional.
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage access errors.
    }
  },

  getJson<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setJson<T>(key: string, value: T): void {
    this.setItem(key, JSON.stringify(value));
  },
};
