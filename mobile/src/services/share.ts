export interface SharePayload {
  title: string;
  url: string;
  text?: string;
}

export interface ShareAdapters {
  native: boolean;
  nativeShare?: (payload: SharePayload) => Promise<void>;
  webShare?: (payload: SharePayload) => Promise<void>;
  copy?: (value: string) => Promise<void>;
}

export type ShareMethod = 'native' | 'web' | 'clipboard';

export async function shareWithFallback(payload: SharePayload, adapters: ShareAdapters): Promise<ShareMethod> {
  if (adapters.native && adapters.nativeShare) {
    await adapters.nativeShare(payload);
    return 'native';
  }

  if (adapters.webShare) {
    await adapters.webShare(payload);
    return 'web';
  }

  if (adapters.copy) {
    await adapters.copy(payload.url);
    return 'clipboard';
  }
  throw new Error('SHARE_UNAVAILABLE');
}
