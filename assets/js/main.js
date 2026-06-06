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
  // 🔮 核心优化：动态替换线上图片并注入移动端触控交互
  // ==========================================
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

  // 📱 为轮播图区域注入手势滑动（Touch Events）支持，让移动端极度丝滑
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

  // 📡 核心修正：解耦鉴权锁，无论登不登录，任何人进站都能秒速加载线上/本地轮播图
  async function syncLiveImagesFromDB() {
    // 默认本地基础图库谱，随时准备为游客做无缝兜底
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
      
      // 只有在实例准备好的时候才向云端伸手拿数据
      if (window.supabaseClient) {
        const { data, error } = await window.supabaseClient
          .from('site_config')
          .select('section, url')
          .eq('section', 'section_banner')
          .maybeSingle();

        if (!error && data && data.url) {
          liveUrls = JSON.parse(data.url);
        }
      }

      // 执行渲染覆盖
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
      console.log('✨ 轮播图流就绪（支持游客免登录浏览）');
    } catch (err) {
      console.warn('正在平滑切换回本地备份图层呈现。');
    }
  }

  // ==========================================
  // 🔐 基础解耦初始化
  // ==========================================
  async function initApp() {
    // 无论如何先渲染出初始基础图层，让页面绝不留白
    showSlide(0);
    startCarousel();

    const workerUrl = 'https://supabase-config-api.xiao-ye751111.workers.dev/';
    try {
      const response = await fetch(workerUrl);
      if (!response.ok) throw new Error();
      const config = await response.json();
      window.sysConfig = config;
      
      if (typeof window.supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      }
    } catch (error) {
      console.log('网路降级，激活前端直连核心。');
      if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(
          'https://kogjjfccyncdszuuwlun.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZ2pqZmNjeW5jZHN6dXV3bHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODEwMDksImV4cCI6MjA5MDQ1NzAwOX0.JIjUQdbZYUM6Cu57pFVwVzrlTrvyYmFyE9eBRlR9Sec'
        );
      }
    }

    // 🌟 无限极解耦：客户端初始化完后，立刻执行图库同步和帖子流抓取
    await syncLiveImagesFromDB();
    await fetchPosts();

    // 检查管理员状态展示入口
    const isAdmin = await checkIsAdminSilent();
    if (isAdmin) {
      const entrance = document.getElementById('admin-entrance-wrapper');
      if (entrance) entrance.style.display = 'block';
    }

    // 监听全局认证改变状态
    if (window.supabaseClient) {
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        updateUserUI(session?.user || null);
      });
    }
  }

  async function checkIsAdminSilent() {
    if (!window.supabaseClient) return false;
    try {
      const { data: { session }, error } = await window.supabaseClient.auth.getSession();
      if (error || !session) return false;
      const OWNER_EMAIL = 'xiao.ye751111@outlook.com';
      return session.user.email === OWNER_EMAIL;
    } catch { return false; }
  }

  function openModal(mode) {
    if (!modal) return;
    modal.removeAttribute('hidden');
    switchMode(mode);
  }

  function closeModal() {
    if (modal) modal.setAttribute('hidden', '');
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
    userButton.addEventListener('click', async () => {
      if (!window.supabaseClient) return;
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        if (confirm('确定要退出登录吗？')) {
          await window.supabaseClient.auth.signOut();
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

      submitBtn.disabled = true;
      const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) { alert(`登录失败: ${error.message}`); submitBtn.disabled = false; return; }
      closeModal();
      window.location.reload();
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
        const li = document.createElement('li');
        li.className = 'post-item';
        const formattedTime = new Date(post.created_at).toLocaleString('zh-CN', { hour12: false });
        
        li.innerHTML = `
          <img class="post-item__avatar" src="${post.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=default'}" alt="头像" loading="lazy">
          <div class="post-item__body">
            <div class="post-item__header">
              <span class="post-item__nickname">${escapeHtml(post.nickname)}</span>
              <span class="post-item__time">${formattedTime}</span>
            </div>
            <p class="post-item__content">${escapeHtml(post.content)}</p>
            <div class="post-item__actions">
              <button class="like-btn ${hasLiked(post.id) ? 'has-liked' : ''}" data-id="${post.id}">
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

  initApp();
});