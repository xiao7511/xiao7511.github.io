// 🌟 1. 全局配置与安全业务实例声明 (收拢为唯一入口)
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

  let currentSlideIndex = 0;

  function showSlide(index) {
    if (carouselSlides.length === 0) return;
    carouselSlides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });
    currentSlideIndex = index;
  }

  function nextSlide() {
    const nextIndex = (currentSlideIndex + 1) % carouselSlides.length;
    showSlide(nextIndex);
  }

  function prevSlide() {
    const prevIndex = (currentSlideIndex - 1 + carouselSlides.length) % carouselSlides.length;
    showSlide(prevIndex);
  }

  function startCarousel() {
    if (prefersReducedMotion || carouselSlides.length <= 1) return;
    stopCarousel();
    carouselTimer = setInterval(nextSlide, 5000); 
  }

  function stopCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
  }

  // 📱 轮播图区域手势支持
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    let touchStartX = 0;
    let touchEndX = 0;

    heroSection.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopCarousel(); 
    }, { passive: true });

    heroSection.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const swipeDistance = touchEndX - touchStartX;
      
      if (swipeDistance > 50) {
        prevSlide(); 
      } else if (swipeDistance < -50) {
        nextSlide(); 
      }
      startCarousel(); 
    }, { passive: true });
  }

  async function syncLiveImagesFromDB() {
    const fallbackImages = {
      section_banner: [
        'images/IMG_4822.jpeg',
        'images/IMG_4823.jpeg',
        'images/IMG_4824.jpeg',
        'images/IMG_4825.jpeg',
        'images/IMG_4826.jpeg'
      ]
    };

    try {
      let liveUrls = [];
      if (window.supabaseClient) {
        const { data, error } = await window.supabaseClient
          .from('site_config')
          .select('section, url')
          .eq('section', 'section_banner')
          .maybeSingle();

        if (!error && data && data.url) {
          liveUrls = JSON.parse(data.url);
          if (typeof window.renderAdminBannerList === 'function') {
            window.renderAdminBannerList(liveUrls);
          }
        }
      }

      carouselSlides.forEach((slide, index) => {
        const imgElement = slide.querySelector('img');
        if (imgElement) {
          if (liveUrls && liveUrls[index]) {
            imgElement.src = liveUrls[index];
          } else {
            imgElement.src = fallbackImages.section_banner[index] || imgElement.src;
          }
        }
      });
    } catch (err) {
      console.warn('正在平滑切换回本地备份图层呈现。');
    }
  }

  // =========================================================
  // 🔐 APP 核心初始化流水线 (高精度重构，消除时序死锁)
  // =========================================================
  async function initApp() {
    showSlide(0);
    startCarousel();
    updateUserUI(null); 

    if (typeof supabase === 'undefined') {
      console.error("Supabase SDK 尚未加载，中断初始化。");
      return;
    }

    const workerUrl = 'https://supabase-config-api.xiao-ye751111.workers.dev/';
    let config = null;

    // 1. 第一步：优先向 Cloudflare Worker 获取最新的动态安全证书
    try {
      // 设定 2.5 秒超短网络超时，防止由于国内手机网络阻断导致主页无限假死
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(workerUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        config = await response.json();
        window.sysConfig = config;
        console.log("🔒 已通过 Cloudflare Workers 安全通道下发动态链路凭证。");
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("⚠️ Cloudflare Worker 握手受阻，自动激活免配置直连沙箱通道。");
      // 直连兜底配置，确保网络不佳时依然能够稳定渲染
      config = {
        SUPABASE_URL: 'https://kogjjfccyncdszuuwlun.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZ2pqZmNjeW5jZHN6dXV3bHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODEwMDksImV4cCI6MjA5MDQ1NzAwOX0.JIjUQdbZYUM6Cu57pFVwVzrlTrvyYmFyE9eBRlR9Sec'
      };
    }

    // 2. 第二步：在全生命周期内【仅创建唯一一次】标准的客户端实例，开启持久化缓存解密
    window.supabaseClient = supabase.createClient(config.SUPABASE_URL.trim(), config.SUPABASE_ANON_KEY.trim(), {
      auth: {
        persistSession: true, // 核心加固：进出管理后台免密、保持持久登录态
        autoRefreshToken: true
      }
    });

    // 3. 第三步：客户端建立完毕后，立即激活状态监听流，彻底断绝 Invalid API key 或 Pending 状态
    activateAuthStateListener();

    // 4. 第四步：拉取内容展现层数据
    await syncLiveImagesFromDB();
    await fetchPosts();
  }

  // =========================================================
  // 🎯 核心加固：将监听逻辑封装，确保其在客户端完全创建成功后运作
  // =========================================================
  function activateAuthStateListener() {
    if (!window.supabaseClient) return;

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        // 先安全执行你原有的更新用户头像、昵称等主页UI逻辑
        updateUserUI(session?.user || null);

        // 获取主页控制台按钮
        const adminBtn = document.getElementById('admin-entrance-wrapper');
        if (!adminBtn) return;

        // 如果用户根本没有登录，利索地隐藏控制台，切断网络请求，防止卡死
        if (!session || !session.user) {
            adminBtn.style.setProperty('display', 'none', 'important');
            return;
        }

        // 🛡️ 运行时防假死双重锁保护：如果此时底层方法没准备好，暂缓鉴权
        if (typeof window.supabaseClient.from !== 'function') {
            console.warn("⚠️ 数据库底层网络映射未就绪，暂缓鉴权...");
            adminBtn.style.setProperty('display', 'none', 'important');
            return;
        }

        try {
            console.log("⏳ 正在前往 users 安全加固表中检索管理员状态...");

            // 前往新创建的 users 表中检索管理员状态
            const { data: userData, error } = await window.supabaseClient
                .from('users')
                .select('is_admin')
                .eq('email', session.user.email)
                .maybeSingle();

            if (error) {
                console.error("Supabase 鉴权发生底层握手错误:", error.message);
                adminBtn.style.setProperty('display', 'none', 'important');
                return;
            }

            // 判定：必须确保 userData 实体存在，且 is_admin 字段真值为 true
            if (userData && userData.is_admin === true) {
                adminBtn.style.setProperty('display', 'block', 'important');
                console.log(`👑 欢迎回来，超级管理员 [${session.user.email}]！控制台已安全就位。`);
            } else {
                // 普通用户或者新注册用户（userData 为空或 false）
                adminBtn.style.setProperty('display', 'none', 'important');
                console.warn(`⚠️ 账号 [${session.user.email}] 属于普通访客，无权显示控制台。`);
            }
        } catch (err) {
            console.error('审查管理员权限时发生致命异常:', err);
            adminBtn.style.setProperty('display', 'none', 'important');
        }
    });
  }

  function openModal(mode) {
    if (!modal) return;
    modal.removeAttribute('hidden');
    modal.style.setProperty('display', 'grid', 'important'); 
    switchMode(mode);
  }

  function closeModal() {
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.style.setProperty('display', 'none', 'important');
    }
  }

  function switchMode(mode) {
    if (mode === 'login') {
      tabLogin.classList.add('is-active');
      tabReg.classList.remove('is-active');
      loginForm.removeAttribute('hidden');
      regForm.setAttribute('hidden', '');
      resetForm.setAttribute('hidden', '');
    } else if (mode === 'reg') {
      tabLogin.classList.remove('is-active');
      tabReg.classList.add('is-active');
      loginForm.setAttribute('hidden', '');
      regForm.removeAttribute('hidden');
      resetForm.setAttribute('hidden', '');
    } else if (mode === 'reset') {
      tabLogin.classList.remove('is-active');
      tabReg.classList.remove('is-active');
      loginForm.setAttribute('hidden', '');
      regForm.setAttribute('hidden', '');
      resetForm.removeAttribute('hidden');
    }
  }

  if (userButton) {
    userButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isLogged = userButton.textContent.includes('欢迎回来');

      if (isLogged) {
        if (confirm('确定要退出登录吗？')) {
          if (window.supabaseClient) await window.supabaseClient.auth.signOut();
          updateUserUI(null); 
          window.location.reload();
        }
      } else {
        openModal('login');
      }
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (tabLogin) tabLogin.addEventListener('click', () => switchMode('login'));
  if (tabReg) tabReg.addEventListener('click', () => switchMode('reg'));
  if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', () => switchMode('reset'));

  if (avatarOptions.length > 0) {
    avatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        avatarOptions.forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedAvatar = btn.dataset.avatar;
      });
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        alert('请输入账号和密码喵！');
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在安全登录...';
      submitBtn.style.opacity = '0.6';

      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) {
          alert(`登录失败: ${error.message}`);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.opacity = '1';
          return;
        }

        closeModal();
        // 成功登录后，系统会自动触发外层的 onAuthStateChange 鉴权逻辑，此处不需重复编写复杂的 UI 显示逻辑

      } catch (err) {
        alert('登录遭遇未知网络异常，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.style.opacity = '1';
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const nickname = document.getElementById('reg-nickname').value.trim() || '新漫友';
      const submitBtn = regForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      const { data, error } = await window.supabaseClient.auth.signUp({
        email, password, options: { redirectTo: REDIRECT_URL }
      });

      if (error) { alert(`注册失败: ${error.message}`); submitBtn.disabled = false; return; }

      if (data.user) {
        await window.supabaseClient.from('profiles').insert([
          { id: data.user.id, nickname, avatar_url: selectedAvatar }
        ]);
      }
      alert('注册成功！请检查邮箱激活邮件。');
      closeModal();
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;
      const password = document.getElementById('new-password').value;
      const { error } = await window.supabaseClient.auth.updateUser({ password });
      if (error) { alert(`修改失败: ${error.message}`); return; }
      alert('密码修改成功，请重新登录。');
      closeModal();
      window.location.reload();
    });
  }

  if (publishBtn) {
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
      await fetchPosts();
    });
  }

  async function fetchPosts() {
    if (!postsList || !window.supabaseClient) return;
    try {
      const { data: posts, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      postsList.innerHTML = posts.length === 0 
        ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">暂无漫友发言，快来抢沙发吧~</p>'
        : '';

      posts.forEach(post => {
        const li = document.createElement('div');
        li.className = 'post';
        const formattedTime = new Date(post.created_at).toLocaleString('zh-CN', { hour12: false });
        
        li.innerHTML = `
          <img class="post__avatar" src="${post.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=default'}" alt="头像" loading="lazy">
          <div class="post__body">
            <div class="post__name">${escapeHtml(post.nickname)}</div>
            <p class="post__content">${escapeHtml(post.content)}</p>
            <div class="post__meta">
              <span>⏱️ ${formattedTime}</span>
              <button class="like-btn ${hasLiked(post.id) ? 'has-liked' : ''}" data-id="${post.id}" style="background:transparent; border:0; margin-left:12px; padding:0; color:inherit;">
                <span class="like-icon">❤️</span> <span class="like-count">${post.likes || 0}</span>
              </button>
            </div>
          </div>
        `;
        postsList.appendChild(li);
      });

      setupLikeButtons();
    } catch (err) {
      postsList.innerHTML = `<p style="text-align:center; color:#ff4757; padding:20px;">帖子加载失败: ${err.message}</p>`;
    }
  }

  function setupLikeButtons() {
    const buttons = Array.from(document.querySelectorAll('.like-btn'));
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!window.supabaseClient) return;
        const postId = btn.dataset.id;
        if (hasLiked(postId)) { alert('你已经给这条发言点过赞啦~'); return; }

        btn.disabled = true;
        const countEl = btn.querySelector('.like-count');
        let currentLikes = parseInt(countEl.innerText) || 0;

        const { error } = await window.supabaseClient
          .from('posts')
          .update({ likes: currentLikes + 1 })
          .eq('id', postId);

        if (error) { alert('点赞失败了QAQ'); btn.disabled = false; return; }

        markAsLiked(postId);
        countEl.innerText = currentLikes + 1;
        btn.classList.add('has-liked');
      });
    });
  }

  function hasLiked(id) { return localStorage.getItem(`liked_${id}`) === 'true'; }
  function markAsLiked(id) { localStorage.setItem(`liked_${id}`, 'true'); }
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function updateUserUI(user) {
    if (!userButton) return;
    if (user) {
      userButton.innerHTML = `<span class="user-status-dot"></span> 欢迎回来, ${user.email.split('@')[0]}`;
      userButton.style.background = 'rgba(255, 255, 255, 0.15)';
      if (postArea) postArea.removeAttribute('hidden');
    } else {
      userButton.innerHTML = '✨ 登录 / 注册专区';
      userButton.style.background = '';
      if (postArea) postArea.setAttribute('hidden', '');
    }
  }

  // ==========================================================
  // ❌ 7. 管理控制台：动态生成配置列表并提供一键删除闭环
  // ==========================================================
  window.renderAdminBannerList = function(imageUrlsArray) {
    const container = document.getElementById('admin-banner-manager-list');
    if (!container) return; 

    container.innerHTML = ''; 

    if (!imageUrlsArray || imageUrlsArray.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:12px;">队列为空</p>';
      return;
    }

    imageUrlsArray.forEach((url, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'admin-image-item';
      itemDiv.innerHTML = `
        <div class="admin-preview-wrapper">
          <img src="${url}" alt="预览">
          <button type="button" class="admin-image-delete-btn" data-index="${index}">✕</button>
        </div>
        <input type="text" class="admin-banner-input" value="${url}" style="flex:1; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:6px; border-radius:6px; font-size:0.8rem;" data-index="${index}">
      `;
      container.appendChild(itemDiv);
    });

    // 绑定删除按钮点击事件
    container.querySelectorAll('.admin-image-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetIndex = parseInt(btn.dataset.index);
        if (confirm(`确定要删除第 ${targetIndex + 1} 张图片吗？`)) {
          imageUrlsArray.splice(targetIndex, 1);
          window.renderAdminBannerList(imageUrlsArray);
          alert('图片已从当前配置列表移除，点击保存配置后将永久同步至数据库！');
        }
      });
    });
  };

  // 启动核心应用
  initApp();

  // 全局智能拦截器
  const globalTriggerModal = (e) => {
    const targetBtn = e.target.closest('#user-btn');
    if (!targetBtn) return;

    if (targetBtn.textContent.includes('登录') || targetBtn.textContent.includes('注册专区')) {
      e.preventDefault();
      e.stopPropagation();

      const authModal = document.getElementById('auth-modal');
      const loginForm = document.getElementById('login-form');
      const regForm = document.getElementById('reg-form');

      if (authModal) {
        authModal.removeAttribute('hidden');
        authModal.style.setProperty('display', 'grid', 'important');
        if (loginForm) loginForm.removeAttribute('hidden');
        if (regForm) regForm.setAttribute('hidden', '');
        
        const tabLogin = document.getElementById('tab-login');
        const tabReg = document.getElementById('tab-reg');
        if (tabLogin) tabLogin.classList.add('is-active');
        if (tabReg) tabReg.classList.remove('is-active');
      }
    }
  };

  document.addEventListener('touchend', globalTriggerModal, { passive: false });
  document.addEventListener('click', globalTriggerModal);
});