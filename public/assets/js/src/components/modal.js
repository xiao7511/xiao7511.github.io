const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function createModalController(modal, { onClose } = {}) {
  if (!modal) return { open() {}, close() {}, isOpen: () => false };

  const panel = modal.querySelector('[role="dialog"]');
  let returnFocus = null;

  const focusable = () => Array.from(panel?.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter((node) => !node.hidden);

  const close = ({ restoreFocus = true } = {}) => {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('has-open-modal');
    document.removeEventListener('keydown', handleKeydown);
    onClose?.();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    const nodes = focusable();
    if (!nodes.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const open = ({ trigger = document.activeElement, initialFocus } = {}) => {
    returnFocus = trigger instanceof HTMLElement ? trigger : null;
    modal.hidden = false;
    document.body.classList.add('has-open-modal');
    document.addEventListener('keydown', handleKeydown);
    requestAnimationFrame(() => {
      const target = initialFocus || focusable()[0] || panel;
      target?.focus();
    });
  };

  modal.addEventListener('mousedown', (event) => {
    if (event.target === modal) close();
  });

  if (panel && !panel.hasAttribute('tabindex')) panel.tabIndex = -1;
  return { open, close, isOpen: () => !modal.hidden };
}

export function setModalOpen(modal, open) {
  if (!modal) return;
  modal.hidden = !open;
  document.body.classList.toggle('has-open-modal', open);
}
