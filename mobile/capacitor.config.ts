import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nobistudio.app',
  appName: 'NOBI 动漫',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#10131b',
      showSpinner: false
    },
    StatusBar: { style: 'DARK', backgroundColor: '#10131b' }
  }
};

export default config;
