import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { Router } from 'vue-router';
import type { useAuthStore } from '../stores/auth';
import { deepLinkRoute } from './deep-links';
import { shareWithFallback } from './share';
import { safeShareUrl } from './urls';

export async function initNative(router: Router, auth: ReturnType<typeof useAuthStore>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.setStyle({ style: Style.Light });
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
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
  const openDeepLink = (url: string) => {
    const target = deepLinkRoute(url);
    if (target && target !== router.currentRoute.value.fullPath) void router.push(target);
  };
  await App.addListener('appUrlOpen', ({ url }) => openDeepLink(url));
  const launch = await App.getLaunchUrl();
  if (launch?.url) openDeepLink(launch.url);
}

export async function hideSplash(): Promise<void> {
  if (Capacitor.isNativePlatform()) await SplashScreen.hide();
}

export async function shareContent(title: string, url: string, text?: string): Promise<void> {
  const safeUrl = safeShareUrl(url);
  if (!safeUrl) throw new Error('UNSAFE_SHARE_URL');
  await shareWithFallback(
    { title, text, url: safeUrl },
    {
      native: Capacitor.isNativePlatform(),
      nativeShare: async (payload) => {
        await Share.share({ ...payload, dialogTitle: '分享 NOBI 内容' });
      },
      webShare: navigator.share ? async (payload) => navigator.share(payload) : undefined,
      copy: navigator.clipboard?.writeText ? async (value) => navigator.clipboard.writeText(value) : undefined
    }
  );
}
