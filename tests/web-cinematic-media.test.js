import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createCardPreviewController,
  createHeroMediaController,
  publicVideoUrl
} from '../public/assets/js/src/home/media.js';

const classList = () => {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value)
  };
};

function fakeVideo() {
  const handlers = new Map();
  return {
    classList: classList(),
    muted: true,
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
    load: vi.fn(),
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: (name) => handlers.delete(name),
    removeAttribute: vi.fn(),
    remove: vi.fn(),
    fire: (name) => handlers.get(name)?.()
  };
}

describe('cinematic media', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('accepts only public HTTPS MP4/WebM URLs', () => {
    expect(publicVideoUrl('https://cdn.example.test/hero.mp4')).toBe('https://cdn.example.test/hero.mp4');
    for (const url of [
      undefined,
      '',
      'http://cdn.test/hero.mp4',
      'javascript:alert(1)',
      'https://user:pass@cdn.test/a.mp4',
      'https://cdn.test/a.svg',
      'https://cdn.test/a.mp4?token=secret'
    ]) {
      expect(publicVideoUrl(url)).toBe('');
    }
  });

  test('keeps poster on absent video, load failure and reduced motion; mute is explicit', () => {
    const video = fakeVideo();
    const mute = {
      hidden: true,
      setAttribute: vi.fn(),
      addEventListener: (_name, handler) => {
        mute.click = handler;
      }
    };
    const controller = createHeroMediaController({}, video, mute);
    controller.setUrl('');
    expect(video.load).not.toHaveBeenCalled();
    controller.setUrl('https://cdn.test/a.mp4');
    expect(mute.hidden).toBe(false);
    expect(video.classList.contains('is-ready')).toBe(false);
    video.fire('canplay');
    expect(video.classList.contains('is-ready')).toBe(true);
    mute.click();
    expect(video.muted).toBe(false);
    expect(mute.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    document.hidden = true;
    document.addEventListener.mock.calls.find(([name]) => name === 'visibilitychange')[1]();
    expect(video.pause).toHaveBeenCalled();
    expect(video.muted).toBe(true);
    video.fire('error');
    expect(video.classList.contains('is-ready')).toBe(false);
    controller.destroy();

    const reducedVideo = fakeVideo();
    createHeroMediaController(
      {},
      reducedVideo,
      { hidden: true, setAttribute: vi.fn(), addEventListener: vi.fn() },
      { reduced: true }
    ).setUrl('https://cdn.test/a.mp4');
    expect(reducedVideo.load).not.toHaveBeenCalled();
  });

  test('only one card preview can be active and leaving removes it', () => {
    vi.useFakeTimers();
    const videos = [];
    document.createElement = () => {
      const video = fakeVideo();
      videos.push(video);
      return video;
    };
    const first = { append: vi.fn() };
    const second = { append: vi.fn() };
    const previews = createCardPreviewController();
    previews.request(first, 'https://cdn.test/one.mp4');
    vi.advanceTimersByTime(260);
    expect(first.append).toHaveBeenCalledTimes(1);
    previews.request(second, 'https://cdn.test/two.mp4');
    expect(videos[0].pause).toHaveBeenCalled();
    expect(videos[0].remove).toHaveBeenCalled();
    vi.advanceTimersByTime(260);
    expect(second.append).toHaveBeenCalledTimes(1);
    videos[0].fire('error');
    expect(videos[1].remove).not.toHaveBeenCalled();
    previews.stop();
    expect(videos[1].remove).toHaveBeenCalled();
  });
});
