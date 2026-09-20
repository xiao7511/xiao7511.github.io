const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function initNavigation() {
  document.querySelectorAll('.nav-toggle').forEach((toggle) => {
    const nav = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭主菜单' : '打开主菜单');
    });
    nav.addEventListener('click', (event) => {
      if (!event.target.closest('a')) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initDialogs() {
  document.querySelectorAll('.modal').forEach((modal) => {
    let returnFocus = null;
    const panel = modal.querySelector('[role="dialog"]');

    const focusFirst = () => {
      const first = panel?.querySelector(focusableSelector);
      first?.focus();
    };
    const restoreFocus = () => {
      document.body.style.overflow = '';
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null;
    };
    const observer = new MutationObserver(() => {
      if (modal.hidden) return restoreFocus();
      returnFocus = document.activeElement;
      document.body.style.overflow = 'hidden';
      queueMicrotask(focusFirst);
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        modal.querySelector('.modal__close')?.click();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(focusableSelector)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDialogs();
});
