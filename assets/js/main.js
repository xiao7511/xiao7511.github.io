// 🌟 1. 全局配置与安全业务实例声明
window.sysConfig = null;
window.supabaseClient = null; 

document.addEventListener('DOMContentLoaded', () => {
  // 获取所有基础 DOM 元素
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

  const REDIRECT_URL = 'https://xiao7511.github.io/index.html';
  let selectedAvatar = avatarOptions[0]?.dataset.avatar || '';
  let carouselTimer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==========================================
  // 🛡️ 核心引擎：运行时从 Cloudflare Worker 获取秘钥
  // ==========================================
  async function initSecurityEngine() {
    try {
      // 1. 去你的独立 Worker 搬钥匙，代码里无痕隔离
      const workerUrl = 'https://supabase-config-api.xiao-ye751111.workers.dev/';
      const response = await fetch(workerUrl);
      if (!response.ok) throw new Error('Worker 响应失败');
      
      const config = await response.json();
      
      window.sysConfig = {
        supabaseUrl: config.SUPABASE_URL.trim(),
        supabaseAnonKey: config.SUPABASE_ANON_KEY.trim()
      };

      // 2. 注入创建全局唯一的安全通信客户端
      window.supabaseClient = supabase.createClient(window.sysConfig.supabaseUrl, window.sysConfig.supabaseAnonKey);
      console.log('🔐 安全通信实例成功构筑，前端硬编码已全面清除。');

      // 3. 订阅密码重置等状态变更
      window.supabaseClient.auth.onAuthStateChange((authEvent) => {
        if (authEvent === 'PASSWORD_RECOVERY') {
          openModal();
          setTab('login');
          if(loginForm) loginForm.hidden = true;
          if(regForm) regForm.hidden = true;
          if(resetForm) resetForm.hidden = false;
        }
      });

      // 4. 按严格时序流水线激活业务
      await refreshUserState();
      await loadPosts();
      await initAdminEntrance();
      
      // 动态获取并覆盖主页所有被部署版面的多图自动轮播
      await renderDynamicLiveCarousels();

    } catch (error) {
      console.error('❌ 安全流初始化断开:', error);
      if (postsList) postsList.innerHTML = '<p class="loading-state">核心组件加载失败，请刷新或联系网管。</p>';
    }
  }

  // ==========================================
  // 🛡️ 管理员隐藏入口链接挂载逻辑
  // ==========================================
  async function initAdminEntrance() {
    try {
        const isAdmin = await checkIsAdminSilent();
        if (isAdmin) {
            const entrance = document.getElementById('admin-entrance-wrapper');
            if (entrance) {
                entrance.style.display = 'block'; 
                console.log('❤️ 欢迎，超级管理员！新版磨砂胶囊控制台通道已安全挂载。');
            }
        }
    } catch (error) {
        console.log('常规访客浏览中...');
    }
  }

  async function checkIsAdminSilent() {
    try {
        if (!window.supabaseClient) return false;
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error || !session) return false;

        const OWNER_EMAIL = 'xiao.ye751111@outlook.com';
        return session.user.email === OWNER_EMAIL;
    } catch (e) {
        return false;
    }
  }

  // ==========================================
  // 🎡 看板多图前台自适应绑定与全自动平滑淡入淡出轮播引擎
  // ==========================================
  async function renderDynamicLiveCarousels() {
    try {
      if (!window.supabaseClient) return;

      const { data: records, error } = await window.supabaseClient
        .from('site_config')
        .select('*');

      if (error || !records) return;

      records.forEach(config => {
        let domElement = null;

        if (config.section === 'section_banner') domElement = document.querySelector('.hero') || document.getElementById('hero-banner-container');
        if (config.section === 'section_anime') domElement = document.getElementById('anime-section-bg') || document.querySelector('.anime-section');
        if (config.section === 'section_community') domElement = document.getElementById('community-section-bg') || document.querySelector('.community-section');
        if (config.section === 'section_recommend') domElement = document.getElementById('recommend-section-bg') || document.querySelector('.recommend-section');

        if (!domElement) return;

        try {
          const imageList = JSON.parse(config.url);
          if (Array.isArray(imageList) && imageList.length > 0) {
            if (imageList.length === 1) {
              domElement.style.backgroundImage = `url('${imageList[0]}')`;
            } else {
              startCustomBackgroundLoop(domElement, imageList);
            }
          }
        } catch (jsonErr) {
          domElement.style.backgroundImage = `url('${config.url}')`;
        }
      });
    } catch (err) {
      console.log('配置库轮播流加载完毕。');
    }
  }

  function startCustomBackgroundLoop(element, urls) {
    let cursor = 0;
    element.style.backgroundImage = `url('${urls[cursor]}')`;
    element.style.transition = "background-image 0.8s ease-in-out";

    setInterval(() => {
      cursor = (cursor + 1) % urls.length;
      element.style.backgroundImage = `url('${urls[cursor]}')`;
    }, 5000);
  }

  // ==========================================
  // 📝 社区互动业务功能
  // ==========================================
  const openModal = () => { if(modal) modal.hidden = false; };
  const closeModal = () => { if(modal) modal.hidden = true; };

  const setTab = (target) => {
    if (!tabLogin || !tabReg) return;
    const loginVisible = target === 'login';
    tabLogin.classList.toggle('is-active', loginVisible);
    tabReg.classList.toggle('is-active', !loginVisible);
    if(loginForm) loginForm.hidden = !loginVisible;
    if(regForm) regForm.hidden = loginVisible;
    if(resetForm) resetForm.hidden = true;
  };

  const escapeText = (value) => {
    const wrapper = document.createElement('div');
    wrapper.textContent = value ?? '';
    return wrapper.textContent;
  };

  const renderPosts = (posts) => {
    if (!postsList) return;
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
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('加载帖子失败:', error);
      if(postsList) postsList.innerHTML = '<p class="loading-state">帖子加载失败，请稍后重试。</p>';
      return;
    }
    renderPosts(data || []);
  };

  const refreshUserState = async () => {
    if (!window.supabaseClient || !userButton) return;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
      userButton.textContent = '登录/注册';
      if(postArea) postArea.hidden = true;
      return;
    }

    const { data: profile } = await window.supabaseClient
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .maybeSingle();

    userButton.textContent = profile?.nickname ? `欢迎，${profile.nickname}` : (user.email?.split('@')[0] || '已登录');
    if(postArea) postArea.hidden = false;
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

  // ==========================================
  // 🔘 用户事件处理绑定 (全面升级手机端防御)
  // ==========================================
  avatarOptions.forEach((button) => {
    button.addEventListener('click', () => {
      avatarOptions.forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      selectedAvatar = button.dataset.avatar || selectedAvatar;
    });
  });

  if(userButton) userButton.addEventListener('click', openModal);
  if(modalClose) modalClose.addEventListener('click', closeModal);
  if(modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  if(tabLogin) tabLogin.addEventListener('click', () => setTab('login'));
  if(tabReg) tabReg.addEventListener('click', () => setTab('reg'));

  if(forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      if (!window.supabaseClient) { alert('安全组件正在初始化，请稍候点击...'); return; }
      const email = document.getElementById('login-email').value.trim();
      if (!email) { alert('请先输入邮箱'); return; }
      
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_URL });
      if (error) { alert(`发送失败: ${error.message}`); return; }
      alert('重置邮件已发送，请检查邮箱。');
    });
  }

  // 📝 注册表单手机端适配优化
  if(regForm) {
    regForm.addEventListener('submit', async (event) => {
      event.preventDefault(); // 🌟 必须置于首行，防止手机浏览器原生机制扰乱
      if (!window.supabaseClient) { alert('系统正在建立安全连接，请稍候重试...'); return; }

      const nick = document.getElementById('reg-nickname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      try {
        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) { alert(`注册失败: ${error.message}`); return; }

        if (data.user) {
          await window.supabaseClient.from('profiles').insert([
            { id: data.user.id, nickname: nick, avatar_url: selectedAvatar },
          ]);
        }

        alert('注册成功，请刷新后登录。');
        closeModal();
        window.location.reload();
      } catch (e) {
        alert('提交遇到错误: ' + e.message);
      }
    });
  }

  // 📝 登录表单手机端适配优化
  if(loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault(); // 🌟 锁死第一行，拦截所有手机端原生刷新
      if (!window.supabaseClient) { alert('系统正在建立安全连接，请稍候重试...'); return; }

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { alert(`登录失败: ${error.message}`); return; }

        alert('欢迎回到游戏大厅！');
        closeModal();
        window.location.reload();
      } catch (e) {
        alert('登录处理中断: ' + e.message);
      }
    });
  }

  if(resetForm) {
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!window.supabaseClient) return;
      const password = document.getElementById('new-password').value;
      const { error } = await window.supabaseClient.auth.updateUser({ password });
      if (error) { alert(`修改失败: ${error.message}`); return; }

      alert('密码修改成功，请重新登录。');
      closeModal();
      window.location.reload();
    });
  }

  if(publishBtn) {
    publishBtn.addEventListener('click', async () => {
      if (!window.supabaseClient) return;
      const content = postContent.value.trim();
      if (!content) { alert('内容不能为空喵！'); return; }

      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) { alert('请先登录后再发帖。'); return; }

      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const { error } = await window.supabaseClient.from('posts').insert([
        {
          content,
          user_id: user.id,
          nickname: profile?.nickname || user.email?.split('@')[0] || '匿名用户',
          avatar_url: profile?.avatar_url || selectedAvatar,
        },
      ]);

      if (error) { alert(`发布失败: ${error.message}`); return; }

      postContent.value = '';
      await loadPosts();
    });
  }

  // 初始化基础状态与轮播
  setTab('login');
  initCarousel();

  // 🚀 核心启动：加载秘钥并全面恢复状态
  initSecurityEngine();

  window.addEventListener('beforeunload', () => {
    if (carouselTimer) window.clearInterval(carouselTimer);
  });
});