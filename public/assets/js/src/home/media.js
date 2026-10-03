export function publicVideoUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /\.(?:mp4|webm)$/i.test(url.pathname)
      ? url.href
      : '';
  } catch {
    return '';
  }
}

export function createHeroMediaController(hero, video, muteButton, options = {}) {
  const reduced = options.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true;
  let currentUrl = '';
  const resetMute = () => {
    video.muted = true;
    muteButton?.setAttribute('aria-label', '开启视频声音');
    muteButton?.setAttribute('aria-pressed', 'false');
  };
  const canPlay = () => Boolean(currentUrl && visible && !document.hidden && !reduced);
  const pause = () => video.pause();
  const resume = () => {
    if (canPlay()) {
      const source = currentUrl;
      void video.play().catch(() => {
        if (source === currentUrl) video.classList.remove('is-ready');
      });
    }
  };
  const onReady = () => {
    if (canPlay()) video.classList.add('is-ready');
    resume();
  };
  const onFailure = () => {
    video.classList.remove('is-ready');
    pause();
  };
  const onVisibility = () => {
    if (document.hidden) {
      resetMute();
      pause();
    } else resume();
  };
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          ([entry]) => {
            visible = Boolean(entry?.isIntersecting);
            if (visible) resume();
            else {
              resetMute();
              pause();
            }
          },
          { threshold: 0.1 }
        )
      : null;
  observer?.observe(hero);
  video.addEventListener('canplay', onReady);
  video.addEventListener('error', onFailure);
  document.addEventListener('visibilitychange', onVisibility);
  muteButton?.addEventListener('click', () => {
    video.muted = !video.muted;
    muteButton.setAttribute('aria-label', video.muted ? '开启视频声音' : '静音视频');
    muteButton.setAttribute('aria-pressed', String(!video.muted));
  });
  return {
    setUrl(value) {
      const next = publicVideoUrl(value);
      resetMute();
      if (next === currentUrl) return;
      onFailure();
      currentUrl = reduced ? '' : next;
      muteButton.hidden = !currentUrl;
      video.removeAttribute('src');
      if (currentUrl) {
        video.src = currentUrl;
        video.load();
        resume();
      }
    },
    destroy() {
      pause();
      observer?.disconnect();
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onFailure);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

export function createCardPreviewController() {
  let active = null;
  let pending = null;
  const stop = () => {
    clearTimeout(pending);
    pending = null;
    if (active) {
      active.pause();
      active.remove();
      active = null;
    }
  };
  return {
    request(media, url, delay = 260) {
      stop();
      const safeUrl = publicVideoUrl(url);
      if (!safeUrl || matchMedia('(prefers-reduced-motion: reduce), (hover: none)').matches) return;
      pending = setTimeout(() => {
        const video = document.createElement('video');
        video.className = 'card__preview';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.addEventListener('canplay', () => video.classList.add('is-ready'), { once: true });
        const fail = () => {
          if (active === video) stop();
        };
        video.addEventListener('error', fail, { once: true });
        video.src = safeUrl;
        media.append(video);
        active = video;
        void video.play().catch(fail);
      }, delay);
    },
    stop
  };
}
