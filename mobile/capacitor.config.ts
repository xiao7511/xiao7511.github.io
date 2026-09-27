import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nobistudio.app',
  appName: 'NOBI 动漫',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: false,
      backgroundColor: '#10131b',
      showSpinner: false
    },
    StatusBar: { style: 'LIGHT', backgroundColor: '#10131b', overlaysWebView: false }
  }
};

export default config;
