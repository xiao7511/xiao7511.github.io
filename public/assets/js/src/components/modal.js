export function setModalOpen(modal, open) {
  if (!modal) return;
  modal.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}
