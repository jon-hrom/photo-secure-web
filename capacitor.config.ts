import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.fotomix.app',
  appName: 'Foto-Mix',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://preview--photo-secure-web.poehali.dev',
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      releaseType: 'AAB'
    }
  }
};

export default config;