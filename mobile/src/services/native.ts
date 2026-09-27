import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { Router } from 'vue-router';
import type { useAuthStore } from '../stores/auth';

export async function initNative(router: Router, auth: ReturnType<typeof useAuthStore>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#10131b' }).catch(() => undefined);
  await App.addListener('backButton', () => {
    if (router.currentRoute.value.path !== '/') {
      if (window.history.state?.back) router.back();
      else void router.replace('/');
    } else if (Capacitor.getPlatform() === 'android') void App.exitApp();
  });
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void auth.resume();
  });
}

export async function hideSplash(): Promise<void> {
  if (Capacitor.isNativePlatform()) await SplashScreen.hide();
}

export async function shareContent(title: string, url: string, text?: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text, url, dialogTitle: '分享 NOBI 内容' });
  } else if (navigator.share) {
    await navigator.share({ title, text, url });
  } else {
    await navigator.clipboard.writeText(url);
  }
}
