export type EnvironmentMode = 'development' | 'production';

const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'AIZABIZ',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
  mode: (import.meta.env.MODE as EnvironmentMode) ?? 'development',
  isProduction: import.meta.env.PROD === true,
  isDevelopment: import.meta.env.DEV === true,
} as const;

export function getRequiredEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || value === 'undefined') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}

export default env;
