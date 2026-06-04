document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://kogjjfccyncdszuuwlun.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZ2pqZmNjeW5jZHN6dXV3bHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODEwMDksImV4cCI6MjA5MDQ1NzAwOX0.JIjUQdbZYUM6Cu57pFVwVzrlTrvyYmFyE9eBRlR9Sec';
  const REDIRECT_URL = 'https://xiao7511.github.io/index.html';
  const carouselSlides = Array.from(document.querySelectorAll('.hero__slide'));
  const userButton = document.getElementById('user-btn');
  const modal = document.getElementById('auth-modal');
  const modalClose = document.getElementById('modal-close');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-reg');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('reg-form');
  const resetForm = document.getElementById('reset-password-form');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const postArea = document.getElementById('post-area');
  const publishBtn = document.getElementById('publish-btn');
  const postContent = document.getElementById('post-content');
  const postsList = document.getElementById('posts-list');
  const avatarOptions = Array.from(document.querySelectorAll('.avatar-option'));

  if (!window.supabase) {
    console.error('Supabase SDK 未加载');
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let selectedAvatar = avatarOptions[0]?.dataset.avatar || '';
  let carouselTimer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const openModal = () => {
    modal.hidden = false;
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  const setTab = (target) => {
    const loginVisible = target === 'login';
    tabLogin.classList.toggle('is-active', loginVisible);
    tabReg.classList.toggle('is-active', !loginVisible);
    loginForm.hidden = !loginVisible;
    regForm.hidden = loginVisible;
    resetForm.hidden = true;
  };

  const escapeText = (value) => {
    const wrapper = document.createElement('div');
    wrapper.textContent = value ?? '';
    return wrapper.textContent;
  };

  const renderPosts = (posts) => {
    postsList.replaceChildren();

    if (!posts || !posts.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'loading-state';
      emptyState.textContent = '暂无动态，快来发布第一条吧。';
      postsList.appendChild(emptyState);
      return;
    }

    const fragment = document.createDocumentFragment();
    posts.forEach((post) => {
      const article = document.createElement('article');
      article.className = 'post';

      const avatar = document.createElement('img');
      avatar.className = 'post__avatar';
      avatar.src = post.avatar_url || '';
      avatar.alt = `${post.nickname || '用户'} 的头像`;
      avatar.loading = 'lazy';
      avatar.decoding = 'async';

      const content = document.createElement('div');

      const name = document.createElement('p');
      name.className = 'post__name';
      name.textContent = escapeText(post.nickname || '匿名用户');

      const text = document.createElement('p');
      text.className = 'post__content';
      text.textContent = escapeText(post.content || '');

      const meta = document.createElement('div');
      meta.className = 'post__meta';
      meta.textContent = new Date(post.created_at).toLocaleString('zh-CN');

      content.append(name, text, meta);
      article.append(avatar, content);
      fragment.appendChild(article);
    });

    postsList.appendChild(fragment);
  };

  const loadPosts = async () => {
    const { data, error } = await supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('加载帖子失败:', error);
      postsList.innerHTML = '<p class="loading-state">帖子加载失败，请稍后重试。</p>';
      return;
    }

    renderPosts(data || []);
  };

  const refreshUserState = async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      userButton.textContent = '登录/注册';
      postArea.hidden = true;
      return;
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .maybeSingle();

    userButton.textContent = profile?.nickname ? `欢迎，${profile.nickname}` : (user.email?.split('@')[0] || '已登录');
    postArea.hidden = false;
  };

  const initCarousel = () => {
    if (prefersReducedMotion || carouselSlides.length <= 1) return;

    let activeIndex = 0;
    carouselTimer = window.setInterval(() => {
      carouselSlides[activeIndex].classList.remove('is-active');
      activeIndex = (activeIndex + 1) % carouselSlides.length;
      carouselSlides[activeIndex].classList.add('is-active');
    }, 4000);
  };

  avatarOptions.forEach((button) => {
    button.addEventListener('click', () => {
      avatarOptions.forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      selectedAvatar = button.dataset.avatar || selectedAvatar;
    });
  });

  userButton.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  tabLogin.addEventListener('click', () => setTab('login'));
  tabReg.addEventListener('click', () => setTab('reg'));

  forgotPasswordBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
      alert('请先输入邮箱');
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: REDIRECT_URL,
    });

    if (error) {
      alert(`发送失败: ${error.message}`);
      return;
    }

    alert('重置邮件已发送，请检查邮箱。');
  });

  regForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nick = document.getElementById('reg-nickname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      alert(`注册失败: ${error.message}`);
      return;
    }

    if (data.user) {
      await supabaseClient.from('profiles').insert([
        { id: data.user.id, nickname: nick, avatar_url: selectedAvatar },
      ]);
    }

    alert('注册成功，请刷新后登录。');
    closeModal();
    window.location.reload();
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert(`登录失败: ${error.message}`);
      return;
    }

    alert('欢迎来到二次元世界！');
    closeModal();
    window.location.reload();
  });

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('new-password').value;
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      alert(`修改失败: ${error.message}`);
      return;
    }

    alert('密码修改成功，请重新登录。');
    closeModal();
    window.location.reload();
  });

  publishBtn.addEventListener('click', async () => {
    const content = postContent.value.trim();
    if (!content) {
      alert('内容不能为空喵！');
      return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      alert('请先登录后再发帖。');
      return;
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const { error } = await supabaseClient.from('posts').insert([
      {
        content,
        user_id: user.id,
        nickname: profile?.nickname || user.email?.split('@')[0] || '匿名用户',
        avatar_url: profile?.avatar_url || selectedAvatar,
      },
    ]);

    if (error) {
      alert(`发布失败: ${error.message}`);
      return;
    }

    postContent.value = '';
    await loadPosts();
  });

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      openModal();
      setTab('login');
      loginForm.hidden = true;
      regForm.hidden = true;
      resetForm.hidden = false;
    }
  });

  setTab('login');
  refreshUserState();
  loadPosts();
  initCarousel();

  window.addEventListener('beforeunload', () => {
    if (carouselTimer) window.clearInterval(carouselTimer);
  });
});
