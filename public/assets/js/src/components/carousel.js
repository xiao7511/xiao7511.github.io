export function createCarousel(slides, { interval = 5000, reducedMotion = false } = {}) {
  let index = 0;
  let timer = null;
  const show = (next) => {
    if (!slides.length) return;
    index = next;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const next = () => show((index + 1) % slides.length);
  const previous = () => show((index - 1 + slides.length) % slides.length);
  const start = () => {
    if (reducedMotion || slides.length <= 1) return;
    stop();
    timer = setInterval(next, interval);
  };
  return { show, start, stop, next, previous };
}
