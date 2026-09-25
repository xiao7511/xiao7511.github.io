export function renderUserHeader(button, user) {
  if (!button) return;
  button.textContent = user?.email ? `欢迎回来, ${user.email.split('@')[0]}` : '✨ 登录 / 注册专区';
}

export function initSiteHeader(root = document) {
  const header = root.querySelector('.site-header');
  const toggle = header?.querySelector('.nav-toggle');
  const navigation = header?.querySelector('.nav');
  const searchToggle = header?.querySelector('.mobile-search-toggle');
  const search = header?.querySelector('.site-search');
  if (!header || !toggle || !navigation || toggle.dataset.navigationReady === 'true') return () => {};
  toggle.dataset.navigationReady = 'true';

  const setOpen = (open, restoreFocus = false) => {
    header.classList.toggle('is-menu-open', open);
    navigation.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭主导航菜单' : '打开主导航菜单');
    if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(!navigation.classList.contains('is-open')));
  searchToggle?.addEventListener('click', () => {
    const open = !header.classList.contains('is-search-open');
    header.classList.toggle('is-search-open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    searchToggle.setAttribute('aria-label', open ? '关闭搜索' : '打开搜索');
    if (open) search?.querySelector('input')?.focus();
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) setOpen(false, true);
    if (event.key === 'Escape' && header.classList.contains('is-search-open')) {
      header.classList.remove('is-search-open');
      searchToggle?.setAttribute('aria-expanded', 'false');
      searchToggle?.focus();
    }
  });

  const desktop = window.matchMedia('(min-width: 769px)');
  desktop.addEventListener('change', (event) => {
    if (event.matches) {
      setOpen(false);
      header.classList.remove('is-search-open');
    }
  });

  return () => setOpen(false);
}

export function updateCopyrightYear(root = document) {
  root.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}
