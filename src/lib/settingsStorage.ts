import { useState, useEffect, useCallback } from 'react';

export interface DeviceSettings {
  theme: 'light' | 'dark' | 'system';
  textSize: 'normal' | 'large' | 'xlarge';
  compactLists: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  underlineLinks: boolean;
  defaultCity: string;
  defaultDistance: number; // 5, 10, 25, 50
  defaultBrowseView: 'list' | 'map';
  itemsPerPage: number; // 10, 20, 50
  showBackToTop: boolean;
  cookieChoice: 'essential' | 'analytics';
}

export const SETTINGS_STORAGE_KEY = 'foodlink_settings';
export const SETTINGS_CHANGE_EVENT = 'foodlink_settings_changed';

export const DEFAULT_SETTINGS: DeviceSettings = {
  theme: 'light',
  textSize: 'normal',
  compactLists: false,
  reduceMotion: false,
  highContrast: false,
  underlineLinks: false,
  defaultCity: 'mumbai',
  defaultDistance: 25,
  defaultBrowseView: 'list',
  itemsPerPage: 10,
  showBackToTop: false,
  cookieChoice: 'essential',
};

// Safe validator ensuring no broken or corrupted data breaks the application
export function validateSettings(parsed: unknown): DeviceSettings {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const p = parsed as Partial<DeviceSettings>;

  const validTheme: DeviceSettings['theme'] =
    p.theme === 'light' || p.theme === 'dark' || p.theme === 'system'
      ? p.theme
      : DEFAULT_SETTINGS.theme;

  const validTextSize: DeviceSettings['textSize'] =
    p.textSize === 'normal' || p.textSize === 'large' || p.textSize === 'xlarge'
      ? p.textSize
      : DEFAULT_SETTINGS.textSize;

  const validDistance = [5, 10, 25, 50].includes(Number(p.defaultDistance))
    ? Number(p.defaultDistance)
    : DEFAULT_SETTINGS.defaultDistance;

  const validBrowseView: DeviceSettings['defaultBrowseView'] =
    p.defaultBrowseView === 'map' ? 'map' : 'list';

  const validItemsPerPage = [10, 20, 50].includes(Number(p.itemsPerPage))
    ? Number(p.itemsPerPage)
    : DEFAULT_SETTINGS.itemsPerPage;

  const validCookieChoice: DeviceSettings['cookieChoice'] =
    p.cookieChoice === 'analytics' ? 'analytics' : 'essential';

  return {
    theme: validTheme,
    textSize: validTextSize,
    compactLists: Boolean(p.compactLists),
    reduceMotion: Boolean(p.reduceMotion),
    highContrast: Boolean(p.highContrast),
    underlineLinks: Boolean(p.underlineLinks),
    defaultCity: typeof p.defaultCity === 'string' && p.defaultCity.trim() ? p.defaultCity : DEFAULT_SETTINGS.defaultCity,
    defaultDistance: validDistance,
    defaultBrowseView: validBrowseView,
    itemsPerPage: validItemsPerPage,
    showBackToTop: Boolean(p.showBackToTop),
    cookieChoice: validCookieChoice,
  };
}

export function getSavedSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let systemThemeMediaQuery: MediaQueryList | null = null;
let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

// Apply settings to DOM elements (theme, text size, motion, contrast, links)
export function applyGlobalSettings(settings: DeviceSettings): void {
  const root = document.documentElement;

  // 1. Resolve Theme
  let isDark = false;
  if (settings.theme === 'dark') {
    isDark = true;
  } else if (settings.theme === 'light') {
    isDark = false;
  } else if (settings.theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (!systemThemeMediaQuery) {
        systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      }
      isDark = systemThemeMediaQuery.matches;

      // Attach listener once if in system mode
      if (!systemThemeListener) {
        systemThemeListener = (e: MediaQueryListEvent) => {
          const current = getSavedSettings();
          if (current.theme === 'system') {
            applyGlobalSettings(current);
          }
        };
        try {
          systemThemeMediaQuery.addEventListener('change', systemThemeListener);
        } catch {
          systemThemeMediaQuery.addListener(systemThemeListener);
        }
      }
    }
  }

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  // Also sync with foodlink_theme key for backwards compatibility
  try {
    localStorage.setItem('foodlink_theme', isDark ? 'dark' : 'light');
  } catch {
    // ignore
  }

  // 2. Text Size
  root.classList.remove('text-size-large', 'text-size-xlarge');
  if (settings.textSize === 'large') {
    root.classList.add('text-size-large');
  } else if (settings.textSize === 'xlarge') {
    root.classList.add('text-size-xlarge');
  }

  // 3. Accessibility Toggles
  root.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  root.classList.toggle('high-contrast', Boolean(settings.highContrast));
  root.classList.toggle('underline-links', Boolean(settings.underlineLinks));
  root.classList.toggle('compact-lists', Boolean(settings.compactLists));
}

export function saveSettings(updates: Partial<DeviceSettings>): DeviceSettings {
  const current = getSavedSettings();
  const merged = validateSettings({ ...current, ...updates });

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Error saving settings to localStorage:', err);
  }

  applyGlobalSettings(merged);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: merged }));
  }

  return merged;
}

export function resetSettings(): DeviceSettings {
  return saveSettings(DEFAULT_SETTINGS);
}

export function clearSavedDeviceSettings(): DeviceSettings {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing settings from localStorage:', err);
  }
  const defaults = { ...DEFAULT_SETTINGS };
  applyGlobalSettings(defaults);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: defaults }));
  }
  return defaults;
}

// React Hook for reactive settings state
export function useSettings() {
  const [settings, setSettings] = useState<DeviceSettings>(() => getSavedSettings());
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    // Initial sync
    const current = getSavedSettings();
    setSettings(current);
    applyGlobalSettings(current);

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<DeviceSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(getSavedSettings());
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    return () => {
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    };
  }, []);

  const updateSetting = useCallback(<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    setSettings((prev) => {
      const updated = saveSettings({ [key]: value });
      setLastSaved(Date.now());
      return updated;
    });
  }, []);

  const resetAll = useCallback(() => {
    const defaults = resetSettings();
    setSettings(defaults);
    setLastSaved(Date.now());
  }, []);

  const clearDevice = useCallback(() => {
    const defaults = clearSavedDeviceSettings();
    setSettings(defaults);
    setLastSaved(Date.now());
  }, []);

  return {
    settings,
    updateSetting,
    resetAll,
    clearDevice,
    lastSaved,
  };
}
