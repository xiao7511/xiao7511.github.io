import { initializeSupabase } from './src/api/supabase.js';
import { togglePostLike } from './src/community/likes.js';
import { groupLikesByPostId } from './src/community/posts.js';
import { createReplyWithOptionalImage, validateReplyImage } from './src/community/reply-images.js';
import { element, setContentState, setImageSource, setLoadingState } from './src/components/dom.js';
import { initSiteHeader, updateCopyrightYear } from './src/components/header.js';
import { getImageKey } from './src/images/likes.js';
import { createModalController } from './src/components/modal.js';
import { applyBannerCtaTargets, resolveBannerItems } from './src/home/banners.js';
import { createCardPreviewController, createHeroMediaController, publicVideoUrl } from './src/home/media.js';
import { createHomeDetailUrl, homeContentLabel, homeContentYear, selectHomeContent } from './src/home/content.js';
import { updateAvatar, validateAvatar } from './src/auth/avatar.js';
import { fetchProfile } from './src/auth/profile.js';
import { registerUser } from './src/auth/registration.js';

// 🌟 1. 全局配置与安全业务实例声明 (收拢为唯一入口)
window.supabaseClient = null;

document.addEventListener('DOMContentLoaded', () => {
  // 🎯 【必须加在最顶端第一行】检查是否是刚才后退回来触发的全新刷新
  if (sessionStorage.getItem('just_backed_from_admin') === 'true') {
      console.log("✨ 成功通过物理重载复苏主页！正在擦除信号并强制清除缓存...");
      sessionStorage.removeItem('just_backed_from_admin'); // 立即销毁标记，防止以后F5刷新被误伤

      // 💡 黑科技：往全局 url 配置里塞一个时间戳参数，强制后续所有 Supabase 图片查询都带上最新时间戳破除缓存
      window.forceCacheBuster = '?v=20260920';
  }

  // 获取所有基础 DOM 元素
  const carouselSlideSlots = Array.from(document.querySelectorAll('.hero__slide'));
  const carouselIndicatorSlots = Array.from(document.querySelectorAll('.hero__pagination span'));
  let carouselSlides = [...carouselSlideSlots];
  let carouselIndicators = [...carouselIndicatorSlots];
  const carouselCounter = document.querySelector('.hero__pagination b');
  const carouselPrevious = document.querySelector('.hero__control--prev');
  const carouselNext = document.querySelector('.hero__control--next');
  const heroEyebrow = document.querySelector('[data-hero-eyebrow]');
  const heroTitle = document.querySelector('[data-hero-title]');
  const heroDescription = document.querySelector('[data-hero-description]');
  const heroTags = document.querySelector('[data-hero-tags]');
  const heroPrimary = document.querySelector('[data-hero-primary]');
  const heroDetail = document.querySelector('[data-hero-detail]');
  const heroSection = document.querySelector('.hero');
  const heroVideo = document.querySelector('.hero__video');
  const heroMute = document.querySelector('.hero__mute');
  const heroMedia = heroSection && heroVideo ? createHeroMediaController(heroSection, heroVideo, heroMute) : null;
  const heroFallback = {
    eyebrow: heroEyebrow?.textContent || '',
    title: heroTitle?.textContent || '',
    description: heroDescription?.textContent || ''
  };
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
  const postTitle = document.getElementById('post-title');
  const postCategory = document.getElementById('post-category');
  const postCharacterCount = document.getElementById('post-character-count');
  const postFeedback = document.getElementById('post-feedback');
  const composeShortcut = document.getElementById('community-compose-shortcut');
  const postsList = document.getElementById('posts-list');
  const avatarOptions = Array.from(document.querySelectorAll('.avatar-option'));
  initSiteHeader();
  updateCopyrightYear();
  document.querySelector('.ranking-tabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || tab.disabled) return;
    document.querySelectorAll('.ranking-tabs [role="tab"]').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
  });
  const modalController = createModalController(modal);

  // 寻找 const avatarOptions = Array.from(document.querySelectorAll('.avatar-option')); 在下方添加： 20260614
  const avatarFileInput = document.getElementById('reg-avatar-file');
  const avatarFileHint = document.getElementById('avatar-file-hint');
  // ✨ 新增：修改头像相关的 DOM 节点获取
  const updateAvatarForm = document.getElementById('update-avatar-form');

  // 🔍 确保在文件顶部获取了新加入的 DOM 元素
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const userProfileForm = document.getElementById('user-profile-form');
  const editAvatarFileInput = document.getElementById('edit-avatar-file');
  const editAvatarHint = document.getElementById('edit-avatar-hint');

  const REDIRECT_URL = `${window.SiteConfig.siteOrigin}/index.html`;
  let selectedAvatar = avatarOptions[0]?.dataset.avatar || '';
  let activeProfileUserId = null;
  let carouselTimer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && typeof IntersectionObserver === 'function') {
    const reveal = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.home-main > .section, .spotlight').forEach((section) => {
      section.classList.add('will-reveal');
      reveal.observe(section);
    });
  }

  let currentSlideIndex = 0;

  function showSlide(index) {
    if (carouselSlides.length === 0) return;
    carouselSlides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });
    carouselIndicators.forEach((indicator, i) => indicator.classList.toggle('is-active', i === index));
    if (carouselCounter) {
      carouselCounter.textContent = String(index + 1).padStart(2, '0');
    }
    const activeSlide = carouselSlides[index];
    if (heroEyebrow) heroEyebrow.textContent = activeSlide.dataset.eyebrow || heroFallback.eyebrow;
    if (heroTitle) heroTitle.textContent = activeSlide.dataset.title || heroFallback.title;
    if (heroDescription) heroDescription.textContent = activeSlide.dataset.description || heroFallback.description;
    const tags = JSON.parse(activeSlide.dataset.tags || '[]');
    if (heroTags) {
      heroTags.replaceChildren(...tags.map((tag) => element('span', { text: tag })));
      heroTags.hidden = !tags.length;
    }
    const detailUrl = activeSlide.dataset.detailUrl || 'recommend.html';
    applyBannerCtaTargets([heroPrimary, heroDetail], detailUrl);
    heroMedia?.setUrl(activeSlide.dataset.videoUrl || '');
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
    if (prefersReducedMotion || document.hidden || carouselSlides.length <= 1) return;
    stopCarousel();
    carouselTimer = setInterval(nextSlide, 5000);
  }

  function stopCarousel() {
    if (carouselTimer) clearInterval(carouselTimer);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCarousel();
    else startCarousel();
  });

  // 📱 轮播图区域手势支持
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

  carouselPrevious?.addEventListener('click', () => {
    prevSlide();
    startCarousel();
  });
  carouselNext?.addEventListener('click', () => {
    nextSlide();
    startCarousel();
  });

  async function syncLiveImagesFromDB() {
    const fallbackImages = {
      section_banner: [
        'images/nobi-cinematic-hero.png',
        'images/nobi-cinematic-hero.png',
        'images/nobi-cinematic-hero.png'
      ]
    };

    try {
      let bannerItems = null;
      if (window.supabaseClient) {
        const [bannerResult, catalogResult] = await Promise.all([
          window.supabaseClient
            .from('content_management')
            .select('*')
            .eq('category', 'banner')
            .order('slot_index', { ascending: true }),
          window.supabaseClient.from('content_management').select('*')
        ]);

        if (!bannerResult.error && !catalogResult.error) {
          bannerItems = resolveBannerItems(bannerResult.data, catalogResult.data);
          renderAdminBannerList(bannerItems.map((item) => item.cover_url).filter(Boolean));
        }
      }

      // 🎯 核心修复：提取全局的时间戳参数，如果没有，默认生成一个普通的，确保每次返回都是最新的
      const buster = window.forceCacheBuster || '?v=20260920';

      if (bannerItems) {
        carouselSlideSlots.forEach((slide, index) => {
          slide.hidden = index >= bannerItems.length;
        });
        carouselIndicatorSlots.forEach((indicator, index) => {
          indicator.hidden = index >= bannerItems.length;
        });
        carouselSlides = carouselSlideSlots.slice(0, bannerItems.length);
        carouselIndicators = carouselIndicatorSlots.slice(0, bannerItems.length);
        currentSlideIndex = Math.min(currentSlideIndex, Math.max(0, carouselSlides.length - 1));
        if (heroSection) heroSection.hidden = bannerItems.length === 0;
        if (!bannerItems.length) {
          stopCarousel();
          return;
        }
      }

      carouselSlides.forEach((slide, index) => {
        const imgElement = slide.querySelector('img');
        if (imgElement) {
          const record = bannerItems?.[index];
          slide.querySelector('.hero__like')?.remove();
          if (record) {
            let source = fallbackImages.section_banner[index] || 'images/nobi-cinematic-hero.png';
            if (record.cover_url) {
              // ⚡ 拼接缓存击穿时间戳，强制浏览器向 Supabase 重新下载新图
              const rawUrl = record.cover_url;
              source = rawUrl.includes('?') ? `${rawUrl}&v=20260920` : rawUrl + buster;
              imgElement.removeAttribute('srcset');
              imgElement.removeAttribute('sizes');
            }
            setImageSource(imgElement, source, fallbackImages.section_banner[index] || 'images/nobi-cinematic-hero.png');
            if (record.id) {
              imgElement.dataset.contentId = record.id;
              imgElement.dataset.imageKind = 'banner';
              imgElement.dataset.imageIndex = '0';
              imgElement.dataset.imageUrl = source;
              imgElement.dataset.previewImage = '';
              if (getImageKey(record.cover_url)) {
                slide.append(element('button', {
                  className: 'hero__like image-like-button',
                  attributes: { type: 'button', 'data-image-like': '', 'aria-label': `点赞 ${record.title || '精选作品'}`, 'aria-pressed': 'false' }
                }, [
                  element('span', { text: '♡', attributes: { 'aria-hidden': 'true' } }),
                  element('span', { text: '点赞', attributes: { 'data-image-like-label': '' } }),
                  element('strong', { text: '0', attributes: { 'data-image-like-count': '' } })
                ]));
              }
            }
            const tags = Array.isArray(record?.theme_tags) ? record.theme_tags.filter(Boolean).slice(0, 4) : [];
            const linked = record.linkedContent;
            const year = homeContentYear(linked || record);
            slide.dataset.eyebrow = linked
              ? [year, linked.category === 'manga' ? '漫画' : '动漫'].filter(Boolean).join(' · ')
              : year || 'NOBI 精选';
            slide.dataset.title = record?.title || '';
            slide.dataset.description = record?.subtitle || '';
            slide.dataset.tags = JSON.stringify(tags);
            slide.dataset.detailUrl = record.detailUrl;
            slide.dataset.videoUrl = record.video_url || '';
          } else {
            setImageSource(imgElement, fallbackImages.section_banner[index] || imgElement.src);
          }
        }
      });
      showSlide(currentSlideIndex);
    } catch (err) {
      console.warn('正在平滑切换回本地备份图层呈现。');
    }
  }

  // ==========================================
  // 1. 增强型应用程序初始化函数（修复并行时序版）
  // ==========================================
  async function initApp() {
    showSlide(0);
    startCarousel();

    try {
      const apiUri = `${window.SiteConfig.apiOrigin}/`;
      const res = await fetch(apiUri);
      if (!res.ok) throw new Error(`Cloudflare 边缘节点异常: ${res.status}`);

      const config = await res.json();
      if (!config.SUPABASE_URL || !config.ANON_KEY) {
        throw new Error("云端载入的通信凭证不完整。");
      }

      // 创建客户端2026.7.10修改
      window.supabaseClient = await initializeSupabase(config);

      console.log("✅ Supabase 安全客户端已成功注入底座！");

      // 🎯 核心修复 1：无论登录与否，立即采用 Promise.all 并发拉取全部图片、四大区域以及论坛列表！
      // 彻底避开身份恢复（onAuthStateChange）时产生的底层网络死锁，让页面从后退中瞬间复活
      try {
        await Promise.all([
          syncLiveImagesFromDB(),   // 刷新轮播图
          loadHomeContent(),         // 刷新动态推荐板块
          fetchPosts()              // 🚀 唤醒并并行加载论坛帖子列表
        ]);
        console.log("📊 站点基础版面、多媒体图层与论坛数据流并行同步完成！");
      } catch (innerErr) {
        console.error("数据流局部渲染受阻，正在继续保障认证链路:", innerErr);
      }

      // 🎯 核心修复 2：解耦身份监听状态。内部严禁做任何阻塞式高频操作，保证论坛状态与控制台不掉线
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log(`🔑 认证状态变更事件触发: ${event}`);
        // ✨ 新增：捕获用户从“忘记密码邮件”点进来的高光时刻
        if (event === "PASSWORD_RECOVERY") {
          setTimeout(() => {
            const newPassword = prompt("🔒 监测到重置凭证成功！请输入您要设定的新密码（至少6位）：");
            if (newPassword) {
              if (newPassword.length < 6) {
                alert("修改失败：密码长度不足6位！");
                return;
              }
              window.supabaseClient.auth.updateUser({ password: newPassword }).then(({ error }) => {
                if (error) alert('密码重置失败，请稍后重试。');
                else alert("🎉 密码重置成功！请使用新密码重新登录异世界。");
              });
            }
          }, 500);
        }

        void checkAdminPermission(session);

      });

    } catch (e) {
      console.warn("未能通过云端拉取配置，启动本地安全后备：", e);
      syncLiveImagesFromDB();
      loadHomeContent();
      fetchPosts();
    }
  }

  // =========================================================
  // 🎯 鉴权核心函数
  // =========================================================
  let adminAuthorizationRequest = 0;

  async function checkAdminPermission(session) {
    const request = ++adminAuthorizationRequest;
    updateUserUI(session?.user || null);

    const adminBtn = document.getElementById('admin-entrance-wrapper') || document.getElementById('admin-btn');
    if (adminBtn) adminBtn.hidden = true;
    document.getElementById('admin-btn-dynamic')?.remove();
    if (!session?.user || typeof window.supabaseClient?.rpc !== 'function') return;

    try {
      const { data: isAdmin, error } = await window.supabaseClient.rpc('is_admin');
      const {
        data: { session: currentSession },
        error: sessionError
      } = await window.supabaseClient.auth.getSession();
      if (
        request !== adminAuthorizationRequest ||
        error ||
        sessionError ||
        isAdmin !== true ||
        currentSession?.user?.id !== session.user.id
      ) return;

      if (adminBtn) {
        adminBtn.hidden = false;
      } else if (!document.getElementById('admin-btn-dynamic')) {
        const adminLink = element('a', {
          className: 'admin-entrance-btn admin-special-btn',
          text: '管理员后台',
          attributes: { id: 'admin-btn-dynamic', href: 'admin.html' }
        });
        userButton?.after(adminLink);
      }
    } catch {
      if (request === adminAuthorizationRequest && adminBtn) adminBtn.hidden = true;
      console.warn('Administrator authorization could not be verified.');
    }
  }
  function activateAuthStateListener() {
    if (!window.supabaseClient) return;

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔄 捕获到 Auth 状态变更事件: ${event}`);
        await checkAdminPermission(session);
    });
  }

  function openModal(mode) {
    if (!modal) return;
    switchMode(mode);
    modalController.open({ trigger: document.activeElement });
  }

  function closeModal() {
    modalController.close();
  }

  /*function switchMode(mode) {
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
  }*/
  function switchMode(mode) {
    if (mode === 'login') {
      tabLogin.classList.add('is-active');
      tabReg.classList.remove('is-active');
      if(loginForm) loginForm.removeAttribute('hidden');
      if(regForm) regForm.setAttribute('hidden', '');
      if(resetForm) resetForm.setAttribute('hidden', '');
      if(userProfileForm) userProfileForm.setAttribute('hidden', '');
    } else if (mode === 'reg') {
      tabLogin.classList.remove('is-active');
      tabReg.classList.add('is-active');
      if(loginForm) loginForm.setAttribute('hidden', '');
      if(regForm) regForm.removeAttribute('hidden');
      if(resetForm) resetForm.setAttribute('hidden', '');
      if(userProfileForm) userProfileForm.setAttribute('hidden', '');
    } else if (mode === 'reset') {
      // 忘记密码模式：隐藏其他，只放行邮件发送框
      tabLogin.classList.remove('is-active');
      tabReg.classList.remove('is-active');
      if(loginForm) loginForm.setAttribute('hidden', '');
      if(regForm) regForm.setAttribute('hidden', '');
      if(resetForm) resetForm.removeAttribute('hidden');
      if(userProfileForm) userProfileForm.setAttribute('hidden', '');
    } else if (mode === 'profile') {
      // 登录后的头像修改个人中心模式
      tabLogin.classList.remove('is-active');
      tabReg.classList.remove('is-active');
      if(loginForm) loginForm.setAttribute('hidden', '');
      if(regForm) regForm.setAttribute('hidden', '');
      if(resetForm) resetForm.setAttribute('hidden', '');
      if(userProfileForm) userProfileForm.removeAttribute('hidden');
    }
  }
  if (userButton) {
    userButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isLogged = userButton.textContent.indexOf('欢迎回来') !== -1;

      if (isLogged) {
        // ✨ 体验优化：已登录状态点击不再直接强制退出，而是拉起模态框切到“修改头像面板”
        openModal('profile');

        // 顺便动态在头像面板底部加一个“退出登录”的安全微型纽带，防止用户找不到退出的地方
        if (!document.getElementById('logout-link-btn')) {
          const logoutButton = element('button', {
            className: 'link-btn link-btn--muted',
            text: '🔮 退出当前账号',
            attributes: { id: 'logout-link-btn', type: 'button' }
          });
          userProfileForm.append(element('div', { className: 'profile-actions' }, [logoutButton]));

          logoutButton.addEventListener('click', async () => {
             if (confirm('确定要退出登录吗？')) {
                 runPhysicalLogout();
             }
          });
        }
      } else {
        if (typeof openModal === 'function') openModal('login');
      }
    });
  }

  // 抽离出的核心物理注销流，保持干净纯粹
  async function runPhysicalLogout() {
    console.log("启动终极物理熔断退出流...");
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      }
    } catch (clearErr) {}
    document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem('is_admin');
    localStorage.removeItem('user_nickname');
    localStorage.removeItem('user_avatar');
    sessionStorage.clear();
    try {
      if (window.supabaseClient && window.supabaseClient.auth) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (signOutErr) {}
    alert('已安全退出登录！');
    window.location.href = window.location.origin + window.location.pathname;
  }
  /*if (userButton) {
      userButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isLogged = userButton.textContent.indexOf('欢迎回来') !== -1;

        if (isLogged) {
          if (confirm('确定要退出登录吗？')) {
            console.log("启动终极物理熔断退出流...");

            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-')) {
                  localStorage.removeItem(key);
                }
              }
            } catch (clearErr) {
              console.warn("清洗官方缓存略有异常:", clearErr);
            }

            document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
            document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            localStorage.removeItem('is_admin');
            localStorage.removeItem('user_nickname');
            localStorage.removeItem('user_avatar');
            sessionStorage.clear();

            try {
              if (window.supabaseClient && window.supabaseClient.auth) {
                await Promise.race([
                  window.supabaseClient.auth.signOut(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                ]);
              }
            } catch (signOutErr) {
              console.warn("云端注销略有延迟，本地已物理断开:", signOutErr);
            }

            alert('已安全退出登录！');
            window.location.href = window.location.origin + window.location.pathname;
          }
        } else {
          if (typeof openModal === 'function') openModal('login');
        }
      });
    }*/

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (tabLogin) tabLogin.addEventListener('click', () => switchMode('login'));
  if (tabReg) tabReg.addEventListener('click', () => switchMode('reg'));
  if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', () => switchMode('reset'));

  /*if (avatarOptions.length > 0) {
    avatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        avatarOptions.forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedAvatar = btn.dataset.avatar;
      });
    });
  }*/
 // 寻找 if (avatarOptions.length > 0) { ... } 整个块，替换修改为：20260614
  if (avatarOptions.length > 0) {
    avatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        avatarOptions.forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedAvatar = btn.dataset.avatar;

        // ✨ 新增：如果选择了预设头像，清空已选的本地文件
        if (avatarFileInput) avatarFileInput.value = '';
        if (avatarFileHint) avatarFileHint.textContent = '';
      });
    });
  }

  // ✨ 新增：监听本地头像选择，并取消预设头像的激活状态
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', () => {
      if (avatarFileInput.files && avatarFileInput.files[0]) {
        const file = avatarFileInput.files[0];
        try {
          validateAvatar(file);
        } catch (error) {
          alert(error.message === 'INVALID_AVATAR_SIZE' ? '头像图片不能超过 5MB。' : '请选择 JPEG、PNG 或 WebP 图片。');
          avatarFileInput.value = '';
          if (avatarFileHint) avatarFileHint.textContent = '';
          return;
        }
        // 取消所有预设的选中样式
        avatarOptions.forEach(b => b.classList.remove('is-selected'));
        if (avatarFileHint) avatarFileHint.textContent = `已选择: ${file.name}`;
      }
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
          alert('登录失败，请检查邮箱和密码后重试。');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.style.opacity = '1';
          return;
        }

        closeModal();
      } catch (err) {
        alert('登录遭遇未知网络异常，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.style.opacity = '1';
      }
    });
  }

  // 寻找 if (regForm) { regForm.addEventListener('submit', ... ) } 块，替换为以下优化版：
  // 🔍 寻找 main.js 中约第 314 行的 if (regForm) 逻辑，用以下代码进行完整替换：
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const nickname = document.getElementById('reg-nickname').value.trim();
      const avatarFile = avatarFileInput?.files?.[0] || null;
      const submitBtn = regForm.querySelector('button[type="submit"]');

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在创建角色...';
      let accountCreated = false;

      try {
        const registration = await registerUser(window.supabaseClient, {
          email,
          password,
          redirectTo: REDIRECT_URL,
          nickname,
          avatarFile,
          onStage(stage) {
            const labels = {
              signing_up: '⏱️ 正在创建角色...',
              confirmation_required: '⏱️ 等待邮箱验证...',
              completing_profile: '⏱️ 正在确认账户资料...',
              saving_nickname: '⏱️ 正在保存昵称...',
              uploading_avatar: '⏱️ 正在上传头像...'
            };
            submitBtn.textContent = labels[stage] || originalText;
          }
        });
        accountCreated = registration.accountCreated;
        const { completion } = registration;

        if (completion.status === 'confirmation_required') {
          alert('账户已创建。请先完成邮箱验证，登录后可在个人中心设置昵称和头像。');
        } else if (completion.status === 'avatar_deferred') {
          alert('账户已创建，头像暂未保存。你可以继续使用账户，并稍后在个人中心重新上传头像。');
        } else {
          alert('注册成功！账户资料已保存。');
        }
        closeModal();

        if (typeof initApp === 'function') {
          initApp();
        } else {
          window.location.reload();
        }
      } catch (err) {
        if (!accountCreated && !err.accountCreated) {
          alert('注册失败，请检查邮箱和密码后重试。');
        } else if (err.code === 'PROFILE_NOT_PROVISIONED') {
          alert('账户已创建，但资料尚未完成初始化（PROFILE_NOT_PROVISIONED）。请稍后登录重试。');
        } else if (err.code === 'NICKNAME_UPDATE_FAILED') {
          alert('账户已创建，但昵称暂未保存。请登录后在个人中心重试。');
        } else {
          alert('账户已创建，但资料完成失败。请登录后在个人中心重试。');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  /*if (resetForm) {
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
  }*/
 // =========================================================
  // 🎯 核心重构：将“修改密码”与“修改头像”融为一体的混编表单
  // =========================================================
  // =========================================================================
  // 🛒 模块一：用户个人中心（已登录状态）- 修改头像
  // =========================================================================
  if (userProfileForm) {
    if (editAvatarFileInput && editAvatarHint) {
      editAvatarFileInput.addEventListener('change', () => {
        if (editAvatarFileInput.files && editAvatarFileInput.files[0]) {
          const file = editAvatarFileInput.files[0];
          try {
            validateAvatar(file);
          } catch (error) {
            alert(error.message === 'INVALID_AVATAR_SIZE' ? '头像图片不能超过 5MB。' : '请选择 JPEG、PNG 或 WebP 图片。');
            editAvatarFileInput.value = '';
            editAvatarHint.textContent = '';
            return;
          }
          editAvatarHint.textContent = `已选择: ${file.name}`;
        }
      });
    }

    userProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session?.user;
      if (!user) {
        alert('登录状态已过期，请重新登录账号。');
        return;
      }

      if (!editAvatarFileInput.files || editAvatarFileInput.files.length === 0) {
        alert('请先选择一张精美的图片作为新头像喵！');
        return;
      }

      const submitBtn = document.getElementById('update-avatar-submit-btn') || userProfileForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在同步新头像...';

      try {
        const file = editAvatarFileInput.files[0];
        const currentProfile = await fetchProfile(window.supabaseClient, user.id);
        if (!currentProfile) throw new Error('PROFILE_NOT_PROVISIONED');
        const finalAvatarUrl = await updateAvatar(
          window.supabaseClient,
          user.id,
          currentProfile.avatar_url,
          file
        );
        localStorage.setItem('user_avatar', finalAvatarUrl);
        if (typeof profile !== 'undefined' && profile) {
          profile.avatar_url = finalAvatarUrl;
        }

        alert('🎉 头像修改成功！论坛各模块已同步刷新。');
        editAvatarFileInput.value = '';
        if (editAvatarHint) editAvatarHint.textContent = '';

        if (typeof closeModal === 'function') closeModal();
        window.location.reload();
      } catch (err) {
        alert(
          err?.code === 'PROFILE_NOT_PROVISIONED'
            ? '账户资料尚未初始化，请稍后重试。'
            : '头像保存失败，请稍后重试。'
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // =========================================================================
  // 🔐 模块二：未登录状态 - 忘记密码（发送安全重置邮件链接）
  // =========================================================================
  // 注意：你代码里似乎 resetForm 和 forgotPasswordForm 都在指代发送邮件，这里我将其统一。
  // 如果你的发送邮件表单 id 是 resetForm，请自行对齐。
  const emailForm = forgotPasswordForm || resetForm;

  if (emailForm && document.getElementById('forgot-email')) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const emailInput = document.getElementById('forgot-email');
      const email = emailInput ? emailInput.value.trim() : '';
      const submitBtn = document.getElementById('forgot-submit-btn') || emailForm.querySelector('button[type="submit"]');

      if (!email) {
        alert('请输入你的注册邮箱哦！');
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在发送链接...';

      try {
        // 调用 Supabase 官方发送重置邮件
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
          // 用户点击链接后跳回当前页面，URL会带上#access_token，自动触发下面的模块三
          redirectTo: window.location.origin + window.location.pathname
        });

        if (error) throw error;

        alert('📬 密码重置链接已发送！请登录邮箱点击链接以重新设定密码。');
        if (typeof closeModal === 'function') closeModal();
      } catch (err) {
        alert('重置邮件发送失败，请稍后重试。');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // =========================================================================
  // 🔄 模块三：核心后续监听 - 捕获邮件链接并处理“输入新密码提交”
  // =========================================================================
  // 当用户点击邮件跳回本页时，Supabase 触发 PASSWORD_RECOVERY 状态
  if (window.supabaseClient && window.supabaseClient.auth) {

    // 1. 🔄 核心状态监听：捕获邮件链接，控制表单显隐
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {

      // 🎯 1. 它是最高优先级！一旦发现是重置信号，立刻拦截
      if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=recovery')) {
        console.log('🚨 侦测到重置密码流，拦截普通登录主页逻辑');

        // 强行隐藏普通的已登录界面（防止它干扰用户）
        const mainDashboard = document.getElementById('dashboard'); // 替换为你已登录主界面的ID
        if (mainDashboard) mainDashboard.hidden = true;

        // 隐藏弹窗内没用的表单
        const loginForm = document.getElementById('login-form');
        const resetForm = document.getElementById('reset-password-form');
        if (loginForm) loginForm.hidden = true;
        if (resetForm) resetForm.hidden = true;

        // 只展示新密码再次确认表单
        const recoveryForm = document.getElementById('recovery-password-form');
        if (recoveryForm) {
          recoveryForm.hidden = false;
        }

        // 唤起大弹窗
        if (typeof openModal === 'function') {
          openModal();
        } else {
          const authModal = document.getElementById('auth-modal');
          if (authModal) authModal.style.display = 'flex';
        }

        return; // 🛑 关键：直接返回，不再往下执行普通的“已登录主页”加载逻辑
      }

      // 2. 下面才是你原本的普通登录、未登录的首页逻辑
      if (event === 'SIGNED_IN') {
        // 处理普通用户登录成功、展示主页、加载数据的逻辑...
        console.log('普通用户登录成功');
      }
    });

    // 2. 🔐 绑定“新密码确认表单”的提交拦截逻辑
    document.addEventListener('DOMContentLoaded', () => {
      const recoveryForm = document.getElementById('recovery-password-form');

      if (recoveryForm) {
        recoveryForm.addEventListener('submit', async (e) => {
          e.preventDefault(); // 阻止表单默认提交刷新

          const passwordInput = document.getElementById('recovery-password');
          const confirmPasswordInput = document.getElementById('recovery-confirm-password');
          const submitBtn = document.getElementById('recovery-submit-btn');

          const newPassword = passwordInput ? passwordInput.value : '';
          const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

          // 🌟 校验一：基础长度检查
          if (newPassword.length < 6) {
            alert('新密码长度不能少于 6 位数哦！');
            return;
          }

          // 🌟 校验二：两次密码一致性判定
          if (newPassword !== confirmPassword) {
            alert('❌ 两次输入的密码不一致，请重新检查喵！');
            // 清空二次确认框并聚焦，提升用户体验
            if (confirmPasswordInput) {
              confirmPasswordInput.value = '';
              confirmPasswordInput.focus();
            }
            return;
          }

          try {
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '⏱️ 正在安全加密并同步新密码...';

            // 调用 Supabase 修改当前账户密码
            const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
            if (error) throw error;

            alert('🎉 密码重置成功！安全凭证已更新，请使用新密码登录。');

            // 强制登出临时的 recovery 会话
            await window.supabaseClient.auth.signOut();

            // 刷新页面，让表单状态和页面完全复位
            window.location.reload();
          } catch (err) {
            alert('密码修改失败，请稍后重试。');
            submitBtn.disabled = false;
            submitBtn.textContent = '确认修改密码';
          }
        });
      }
    });
  }

  /*if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      if (!window.supabaseClient) return;
      const content = postContent.value.trim();
      if (!content) { alert('内容不能为空喵！'); return; }

     // const { data: { user } } = await window.supabaseClient.auth.getUser();
    //  if (!user) { alert('请先登录后再发帖。'); return; }
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session ? session.user : null;
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
  }*/
  let currentForumPage = 1;
  const pageSize = 5;

  postContent?.addEventListener('input', () => {
    if (postCharacterCount) postCharacterCount.textContent = `${postContent.value.length} / 500`;
  });
  composeShortcut?.addEventListener('click', () => {
    if (postArea?.hidden) {
      openModal('login');
      return;
    }
    postTitle?.focus();
    postArea.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
  });

  // 1. 发帖逻辑：确保获取最新个人头像与昵称
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      if (!window.supabaseClient) return;
      const content = postContent.value.trim();
      if (!content) {
        if (postFeedback) postFeedback.textContent = '请先写一点内容再发布。';
        postContent.focus();
        return;
      }

      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session ? session.user : null;
      if (!user) { openModal('login'); return; }
      publishBtn.disabled = true;
      publishBtn.textContent = '发布中…';
      if (postFeedback) postFeedback.textContent = '正在发布话题…';

      // 获取最新 profiles 数据
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const finalAvatar = profile?.avatar_url || localStorage.getItem('user_avatar') || selectedAvatar;
      const finalNickname = profile?.nickname || localStorage.getItem('user_nickname') || user.email?.split('@')[0] || '匿名用户';

      const { error } = await window.supabaseClient.from('posts').insert([
        {
          content,
          title: postTitle?.value.trim() || null,
          category: postCategory?.value || '交流',
          user_id: user.id,
          nickname: finalNickname,
          avatar_url: finalAvatar,
          parent_id: null // 主贴
        },
      ]);

      if (error) {
        if (postFeedback) postFeedback.textContent = '发布失败，请稍后重试。';
        publishBtn.disabled = false;
        publishBtn.textContent = '发布动态';
        return;
      }
      postContent.value = '';
      if (postTitle) postTitle.value = '';
      if (postCharacterCount) postCharacterCount.textContent = '0 / 500';
      if (postFeedback) postFeedback.textContent = '发布成功。';
      publishBtn.disabled = false;
      publishBtn.textContent = '发布动态';
      currentForumPage = 1;
      await fetchPosts();
    });
  }

  // 2. 渲染主贴、回复与分页
  const createForumAvatar = (value, className, label) => {
    const image = element('img', {
      className: `post-avatar ${className}`,
      attributes: { alt: label, loading: 'lazy', decoding: 'async' }
    });
    setImageSource(image, value, 'images/nobi-avatar.svg');
    return image;
  };

  const createReplyItem = (reply) => {
    const replyHeader = element('div', { className: 'reply-header' }, [
      createForumAvatar(
        reply.avatar_url || reply.avatar,
        'post-avatar--tiny',
        `${reply.nickname || '社区用户'}的头像`
      ),
      element('span', { className: 'reply-author', text: reply.nickname || '热心网友' }),
      element('time', {
        className: 'reply-time',
        text: new Date(reply.created_at).toLocaleTimeString(),
        attributes: { datetime: reply.created_at }
      })
    ]);
    const body = element('div', { className: 'reply-content' });
    if (reply.content) body.append(element('div', { text: reply.content }));
    if (reply.image_path) {
      const image = element('img', {
        className: 'reply-image',
        attributes: { alt: '回复图片', loading: 'lazy', decoding: 'async' }
      });
      const fallback = element('span', {
        className: 'reply-image-fallback',
        text: '图片加载失败',
        attributes: { hidden: '', role: 'status' }
      });
      const frame = element('div', { className: 'reply-image-frame' }, [image, fallback]);
      const showFallback = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
      try {
        const imageUrl = window.supabaseClient.storage.from('community').getPublicUrl(reply.image_path).data.publicUrl;
        if (setImageSource(image, imageUrl)) image.addEventListener('error', showFallback, { once: true });
        else showFallback();
      } catch (_) {
        showFallback();
      }
      body.append(frame);
    }
    return element('div', { className: 'reply-item' }, [replyHeader, body]);
  };

  async function fetchPosts() {
    if (!postsList) return;

    setLoadingState(postsList, { count: 3, variant: 'post', label: '正在加载社区动态' });

    try {
      const startIndex = (currentForumPage - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;

      // 获取主贴总数
      const { count: totalCount } = await window.supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .is('parent_id', null);

      // 查询当前页主贴（按最新排序）
      const { data: mainPosts, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) {
        console.error("查询主贴报错:", error);
        throw error;
      }

      // 当前页的回复与点赞均使用批量查询，避免 N+1 请求。
      const mainPostIds = (mainPosts || []).map(p => p.id);
      let replies = [];
      let likeRows = [];
      let currentUser = null;
      if (mainPostIds.length > 0) {
        const [replyResult, likeResult, sessionResult] = await Promise.all([
          window.supabaseClient.from('posts').select('*').in('parent_id', mainPostIds).order('created_at', { ascending: true }),
          window.supabaseClient.from('post_likes').select('post_id,user_id').in('post_id', mainPostIds),
          window.supabaseClient.auth.getSession()
        ]);
        if (replyResult.error) console.error("查询回复报错:", replyResult.error);
        if (likeResult.error) throw likeResult.error;
        replies = replyResult.data || [];
        likeRows = likeResult.data || [];
        currentUser = sessionResult.data?.session?.user || null;
      }

      const likesByPostId = groupLikesByPostId(likeRows);

      postsList.removeAttribute('aria-busy');
      postsList.replaceChildren();

      if (!mainPosts || mainPosts.length === 0) {
        setContentState(postsList, { message: '还没有社区动态，登录后发布第一条内容吧。' });
        return;
      }
      mainPosts.forEach((post) => {
        const postCard = element('article', { className: 'post-card' });
        const likedUserIds = likesByPostId.get(post.id) || [];
        const isLiked = Boolean(currentUser && likedUserIds.includes(currentUser.id));
        const header = element('div', { className: 'post-header' });
        header.append(
          createForumAvatar(post.avatar_url || post.avatar, 'post-avatar--small', `${post.nickname || '社区用户'}的头像`),
          element('div', {}, [
            element('div', { className: 'post-author', text: post.nickname || '神秘漫友' }),
            element('time', {
              className: 'post-time',
              text: new Date(post.created_at).toLocaleString(),
              attributes: { datetime: post.created_at }
            })
          ])
        );
        if (post.category) header.append(element('span', { className: 'post-category', text: post.category }));

        const postReplies = replies.filter((reply) => reply.parent_id === post.id);
        const actions = element('div', { className: 'post-actions' });
        const likeButton = element('button', {
          className: `post-action like-action-btn${isLiked ? ' is-liked' : ''}`,
          text: `${isLiked ? '❤️ 已赞' : '🤍 点赞'}（${likedUserIds.length}）`,
          attributes: { type: 'button', 'aria-pressed': String(isLiked), 'data-like-count': likedUserIds.length }
        });
        const replyButton = element('button', {
          className: 'post-action reply-action-btn',
          text: `💬 回复（${postReplies.length}）`,
          attributes: {
            type: 'button',
            'aria-expanded': 'false',
            'aria-controls': `reply-box-${post.id}`,
            'data-reply-count': postReplies.length
          }
        });
        actions.append(likeButton, replyButton);

        const repliesContainer = element('div', { className: 'replies' });
        postReplies.forEach((reply) => {
          repliesContainer.append(createReplyItem(reply));
        });

        const replyInput = element('input', {
          className: 'reply-input',
          attributes: {
            type: 'text',
            placeholder: '写下你的精彩回复...',
            'aria-label': `回复${post.nickname || '该用户'}`
          }
        });
        const submitReplyButton = element('button', {
          className: 'reply-submit',
          text: '发送',
          attributes: { type: 'button' }
        });
        const replyFileInput = element('input', {
          className: 'reply-image-input',
          attributes: { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': '添加一张回复图片' }
        });
        const replyImageButton = element(
          'label',
          { className: 'reply-image-button', attributes: { title: '添加图片' } },
          [
            element('span', { className: 'reply-image-button__icon', text: '🖼', attributes: { 'aria-hidden': 'true' } }),
            element('span', { className: 'sr-only', text: '添加图片' }),
            replyFileInput
          ]
        );
        const replyPreview = element('div', { className: 'reply-image-preview', attributes: { hidden: '' } });

        const clearReplyImageSelection = () => {
          if (replyPreview.dataset.objectUrl) URL.revokeObjectURL(replyPreview.dataset.objectUrl);
          delete replyPreview.dataset.objectUrl;
          replyFileInput.value = '';
          replyPreview.hidden = true;
          replyPreview.replaceChildren();
        };

        replyFileInput.addEventListener('change', () => {
          const file = replyFileInput.files?.[0];
          if (replyPreview.dataset.objectUrl) URL.revokeObjectURL(replyPreview.dataset.objectUrl);
          delete replyPreview.dataset.objectUrl;
          replyPreview.replaceChildren();
          if (!file) { replyPreview.hidden = true; return; }
          try {
            validateReplyImage(file);
            const image = element('img', { attributes: { alt: '待上传图片预览' } });
            const objectUrl = URL.createObjectURL(file);
            replyPreview.dataset.objectUrl = objectUrl;
            image.src = objectUrl;
            const remove = element('button', { text: '×', attributes: { type: 'button', 'aria-label': '移除图片' } });
            remove.addEventListener('click', clearReplyImageSelection);
            const fileSize = `${(file.size / 1024).toFixed(file.size >= 1024 ? 0 : 1)} KB`;
            replyPreview.append(
              image,
              element('span', { className: 'reply-image-preview__meta', text: `${file.name} · ${fileSize}` }),
              remove
            );
            replyPreview.hidden = false;
          } catch (error) {
            clearReplyImageSelection();
            alert(error.message);
          }
        });
        const replyControls = element('div', { className: 'reply-controls' }, [
          replyImageButton,
          replyInput,
          submitReplyButton
        ]);
        const replyBox = element(
          'div',
          {
            className: 'reply-box',
            attributes: { id: `reply-box-${post.id}`, hidden: '' }
          },
          [replyPreview, replyControls]
        );

        likeButton.addEventListener('click', async () => {
          await toggleLike(post.id, likeButton);
        });
        replyButton.addEventListener('click', () => {
          const willOpen = replyBox.hidden;
          replyBox.hidden = !willOpen;
          replyButton.setAttribute('aria-expanded', String(willOpen));
          if (willOpen) replyInput.focus();
        });
        submitReplyButton.addEventListener('click', () =>
          submitReply(
            post.id,
            replyInput,
            replyFileInput,
            replyPreview,
            repliesContainer,
            replyButton,
            submitReplyButton,
            replyImageButton,
            clearReplyImageSelection
          )
        );

        postCard.append(header);
        if (post.title) postCard.append(element('h2', { className: 'post-title', text: post.title }));
        postCard.append(element('div', { className: 'post-body', text: post.content }), actions, repliesContainer, replyBox);
        postsList.append(postCard);
      });

      const totalPages = Math.ceil((totalCount || 0) / pageSize);
      if (totalPages > 1) {
        const previousButton = element('button', {
          text: '上一页',
          attributes: { type: 'button', disabled: currentForumPage === 1 ? '' : null }
        });
        if (currentForumPage !== 1) previousButton.removeAttribute('disabled');

        const nextButton = element('button', {
          text: '下一页',
          attributes: { type: 'button', disabled: currentForumPage >= totalPages ? '' : null }
        });
        if (currentForumPage < totalPages) nextButton.removeAttribute('disabled');

        const pagination = element('nav', { className: 'forum-pagination', attributes: { 'aria-label': '社区分页' } }, [
          previousButton,
          element('span', {
            text: `第 ${currentForumPage} / ${totalPages} 页（共 ${totalCount} 条）`,
            attributes: { 'aria-live': 'polite' }
          }),
          nextButton
        ]);
        postsList.append(pagination);

        previousButton.addEventListener('click', () => {
          if (currentForumPage > 1) {
            currentForumPage -= 1;
            fetchPosts();
            postsList.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
          }
        });
        nextButton.addEventListener('click', () => {
          if (currentForumPage < totalPages) {
            currentForumPage += 1;
            fetchPosts();
            postsList.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
          }
        });
      }
    } catch (err) {
      console.error("fetchPosts 渲染异常:", err);
      setContentState(postsList, {
        message: '社区动态加载失败，请检查网络后重试。',
        kind: 'error',
        onRetry: fetchPosts
      });
    }
  }
  // ==========================================
  // 🎯 论坛全新架构：Fetch 帖子与二级树状评论渲染
  // ==========================================
  async function toggleLike(postId, button) {
    const isLiked = button.getAttribute('aria-pressed') === 'true';
    const previousCount = Number(button.dataset.likeCount) || 0;
    button.disabled = true;
    try {
      const result = await togglePostLike(window.supabaseClient, { postId, isLiked });
      if (!result.authenticated) {
        alert('登录状态已失效，请重新登录后再试。');
        return;
      }
      const liked = result.liked;
      const likeCount = result.likeCount ?? Math.max(0, previousCount + (liked ? 1 : -1));
      button.dataset.likeCount = String(likeCount);
      button.classList.toggle('is-liked', liked);
      button.setAttribute('aria-pressed', String(liked));
      button.textContent = `${liked ? '❤️ 已赞' : '🤍 点赞'}（${likeCount}）`;
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('nobi-engagement');
        channel.postMessage({ type: 'post-like-changed' });
        channel.close();
      }
    } catch(err) {
      console.error("点赞操作失败:", err);
      alert('点赞失败，请稍后重试。');
    } finally {
      button.disabled = false;
    }
  }

  // 3. 提交回复逻辑：同步更新最新的头像与昵称
  async function submitReply(
    postId,
    inputElem,
    fileInput,
    preview,
    repliesContainer,
    replyButton,
    submitButton,
    imageButton,
    clearReplyImageSelection
  ) {
    if (!window.supabaseClient) return;
    if (!inputElem) return;
    if (submitButton.dataset.sending === 'true') return;
    const content = inputElem.value.trim();
    const file = fileInput?.files?.[0] || null;
    if (!content && !file) { alert('请输入回复内容或选择图片。'); return; }
    try {
      if (file) validateReplyImage(file);
    } catch (error) {
      clearReplyImageSelection?.();
      alert(error.message);
      return;
    }

    submitButton.dataset.sending = 'true';
    submitButton.disabled = true;
    submitButton.textContent = '发送中…';
    inputElem.disabled = true;
    if (fileInput) fileInput.disabled = true;
    imageButton?.classList.add('is-disabled');
    imageButton?.setAttribute('aria-disabled', 'true');
    preview?.setAttribute('aria-busy', 'true');

    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session ? session.user : null;
      if (!user) {
        alert('请先登录后再回复。');
        return;
      }

      // 回复时实时获取 profiles 表中的最新昵称和头像。
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const finalAvatar = profile?.avatar_url || localStorage.getItem('user_avatar') || selectedAvatar;
      const finalNickname = profile?.nickname || localStorage.getItem('user_nickname') || user.email?.split('@')[0] || '匿名用户';

      const uploaded = await createReplyWithOptionalImage(window.supabaseClient, {
        userId: user.id,
        file,
        createReply: async (imagePath) => {
          const { error } = await window.supabaseClient.from('posts').insert([
            {
              content,
              user_id: user.id,
              nickname: finalNickname,
              avatar_url: finalAvatar,
              parent_id: postId,
              image_path: imagePath
            }
          ]);
          if (error) throw error;
        }
      });

      inputElem.value = '';
      clearReplyImageSelection?.();
      repliesContainer.append(
        createReplyItem({
          content,
          nickname: finalNickname,
          avatar_url: finalAvatar,
          image_path: uploaded?.path || null,
          created_at: new Date().toISOString()
        })
      );
      const replyCount = (Number(replyButton.dataset.replyCount) || 0) + 1;
      replyButton.dataset.replyCount = String(replyCount);
      replyButton.textContent = `💬 回复（${replyCount}）`;
    } catch (error) {
      if (error.cleanupError) console.error('回复创建失败，且上传图片清理失败:', error.cleanupError);
      alert('回复发布失败，请稍后重试。');
    } finally {
      delete submitButton.dataset.sending;
      submitButton.disabled = false;
      submitButton.textContent = '发送';
      inputElem.disabled = false;
      if (fileInput) fileInput.disabled = false;
      imageButton?.classList.remove('is-disabled');
      imageButton?.removeAttribute('aria-disabled');
      preview?.removeAttribute('aria-busy');
    }
  }

 /* window.submitReply = async function(postId) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const user = session?.user;

    if (!user) {
      alert("请先登录再发表评论回复！");
      return;
    }

    const input = document.getElementById(`reply-input-${postId}`);
    if (!input || !input.value.trim()) {
      alert("回复内容不能为空哦！");
      return;
    }

    try {
      const nickname = localStorage.getItem('user_nickname') || user.email.split('@')[0];
      const avatarUrl = localStorage.getItem('user_avatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=Neko';

      const { error } = await window.supabaseClient
        .from('posts')
        .insert([{
          content: input.value.trim(),
          nickname: nickname,
          avatar_url: avatarUrl,
          parent_id: postId
        }]);

      if (error) throw error;
      input.value = '';
      await fetchPosts();
    } catch (err) {
      alert("回复失败: " + err.message);
    }
  };*/

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

  // 🌟 3. 增强型用户 UI 状态更新与完全非阻塞异步鉴权函数
  function updateUserUI(user) {
    activeProfileUserId = user?.id || null;
    if (!userButton) return;

    // 获取后台控制入口按钮元素（兼容代码中出现的两种 ID 命名）
    let adminButton = document.getElementById('admin-entrance-wrapper') || document.getElementById('admin-btn');

    if (user) {
      // (1) 瞬间渲染并点亮前端用户登录状态（零延迟响应）
      const fallbackAvatar = element('img', {
        className: 'nav-avatar',
        attributes: { alt: '', width: '30', height: '30', src: 'images/nobi-avatar.svg' }
      });
      const accountLabel = element('span', { className: 'account-control__label', text: `欢迎回来, ${user.email.split('@')[0]}` });
      userButton.replaceChildren(fallbackAvatar, accountLabel);
      userButton.classList.add('is-authenticated');
      const accountName = user.email.split('@')[0];
      userButton.setAttribute('aria-label', `已登录：${accountName}，打开账户设置`);
      userButton.title = `已登录：${accountName}`;

      window.supabaseClient
        ?.from('profiles')
        .select('nickname,avatar_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data || activeProfileUserId !== user.id || !userButton.classList.contains('is-authenticated')) return;
          setImageSource(fallbackAvatar, data.avatar_url, 'images/nobi-avatar.svg');
          accountLabel.textContent = `欢迎回来, ${data.nickname || accountName}`;
        });

      // ✨ 修改：登录成功后，让“修改头像面板”浮现、让“忘记密码”隐藏
      if (userProfileForm) userProfileForm.hidden = false;
      if (forgotPasswordForm) forgotPasswordForm.hidden = true;

      // (2) 🚀 瞬间无缝唤醒论坛：全物理接触隐藏，彻底防止论坛处于断开或僵尸挂起状态
      if (postArea) {
        postArea.removeAttribute('hidden');
        postArea.style.display = 'block';
      }
      if (publishBtn) publishBtn.removeAttribute('disabled');
    } else {
      // (4) 用户未登录或退出登录时，全面物理还原界面并封锁论坛发布功能
      clearUserUI();

      // ✨ 修改：未登录时，物理隐藏头像修改面板
      if (userProfileForm) userProfileForm.hidden = true;

      document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      removeAdminButton();
    }

    // 辅助工具：安全解除管理按钮
    function removeAdminButton() {
      if (adminButton) {
        adminButton.setAttribute('hidden', 'true');
        adminButton.hidden = true;
      }
      const dynamicBtn = document.getElementById('admin-btn-dynamic');
      if (dynamicBtn) dynamicBtn.remove();
    }
  }

  // 负责退出登录或未登录时的界面复原
  function clearUserUI() {
     if (userButton) {
        userButton.replaceChildren(element('span', { className: 'account-control__label', text: '登录' }));
        userButton.classList.remove('is-authenticated');
        userButton.setAttribute('aria-label', '登录或注册');
        userButton.title = '登录或注册';
     }
     if (postArea) {
        postArea.setAttribute('hidden', '');
        postArea.style.display = 'none';
     }
     if (publishBtn) publishBtn.setAttribute('disabled', 'true');
  }

  function renderAdminBannerList(imageUrlsArray) {
    const container = document.getElementById('admin-banner-manager-list');
    if (!container) return;
    container.replaceChildren();

    if (!imageUrlsArray || imageUrlsArray.length === 0) {
      setContentState(container, { message: '队列为空' });
      return;
    }

    imageUrlsArray.forEach((url, index) => {
      const image = element('img', { attributes: { alt: `轮播图预览 ${index + 1}` } });
      setImageSource(image, url);
      const deleteButton = element('button', {
        className: 'admin-image-delete-btn',
        text: '✕',
        attributes: { type: 'button', 'data-index': index, 'aria-label': `删除第 ${index + 1} 张轮播图` }
      });
      const input = element('input', {
        className: 'admin-banner-input',
        attributes: { type: 'text', value: url, 'data-index': index, 'aria-label': `第 ${index + 1} 张轮播图地址` }
      });
      const item = element('div', { className: 'admin-image-item' }, [
        element('div', { className: 'admin-preview-wrapper' }, [image, deleteButton]),
        input
      ]);
      container.append(item);

      deleteButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (confirm(`确定要删除第 ${index + 1} 张图片吗？`)) {
          imageUrlsArray.splice(index, 1);
          renderAdminBannerList(imageUrlsArray);
          alert('图片已从当前配置列表移除，点击保存配置后将永久同步至数据库！');
        }
      });
    });
  }

  // ==========================================
  // 📺 前台核心：从 site_config 表读取部署数据并无缝对齐四大区域
  // ==========================================
  async function loadDeployedSections() {
    if (!window.supabaseClient) return;

    try {
      const { data: configs, error } = await window.supabaseClient.from('site_config').select('section, url');
      if (error) throw error;

      (configs || []).forEach((config) => {
        let imageUrls = [];
        try {
          imageUrls = typeof config.url === 'string' ? JSON.parse(config.url) : config.url;
        } catch (parseError) {
          console.error(`解析区域 ${config.section} 的图片列表失败:`, parseError);
          return;
        }
        if (!Array.isArray(imageUrls) || !imageUrls.length) return;

        if (config.section === 'section_banner') {
          const container = document.getElementById('banner-slider') || document.querySelector('.swiper-wrapper');
          if (!container) return;
          container.replaceChildren(
            ...imageUrls.map((url, index) => {
              const image = element('img', {
                className: 'dynamic-banner-image',
                attributes: { alt: `首页轮播图 ${index + 1}`, loading: index ? 'lazy' : 'eager', decoding: 'async' }
              });
              setImageSource(image, url, 'images/IMG_4822.jpeg');
              return element('div', { className: 'swiper-slide' }, [image]);
            })
          );
          return;
        }

        if (config.section === 'section_anime') {
          const container = document.getElementById('anime-section-grid') || document.querySelector('.anime-grid');
          if (!container) return;
          container.replaceChildren(
            ...imageUrls.map((url, index) => {
              const image = element('img', {
                className: 'dynamic-section-image',
                attributes: { alt: `动漫推荐 ${index + 1}`, loading: 'lazy', decoding: 'async' }
              });
              setImageSource(image, url, 'images/IMG_4893.webp');
              return element('a', { className: 'anime-card card--link dynamic-anime-card', attributes: { href: 'recommend.html' } }, [
                image,
                element('div', { className: 'dynamic-anime-title', text: `动漫热播推荐 ${index + 1}` })
              ]);
            })
          );
          return;
        }

        if (config.section === 'section_community') {
          const container = document.getElementById('community-section-images') || document.querySelector('.community-banners');
          if (!container) return;
          container.replaceChildren(
            ...imageUrls.map((url, index) => {
              const image = element('img', {
                className: 'dynamic-section-image dynamic-community-image',
                attributes: { alt: `社区精选图 ${index + 1}`, loading: 'lazy', decoding: 'async' }
              });
              setImageSource(image, url, 'images/IMG_4893.webp');
              return element('div', { className: 'community-banner-item' }, [image]);
            })
          );
          return;
        }

        if (config.section === 'section_recommend') {
          const container = document.getElementById('recommend-section-cards') || document.querySelector('.recommend-grid');
          if (!container) return;
          container.replaceChildren(
            ...imageUrls.map((url, index) => {
              const image = element('img', {
                className: 'dynamic-section-image dynamic-recommend-image',
                attributes: { alt: `精选推荐 ${index + 1}`, loading: 'lazy', decoding: 'async' }
              });
              setImageSource(image, url, 'images/IMG_4893.webp');
              return element('a', { className: 'recommend-card-item card--link', attributes: { href: 'recommend.html' } }, [
                image
              ]);
            })
          );
        }
      });
    } catch (error) {
      console.error('前台版面配置加载失败:', error);
    }
  }

  async function loadHomeContent() {
    const ANIME_FALLBACK = 'images/nobi-anime-placeholder.svg';
    const cardPreview = createCardPreviewController();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cardPreview.stop();
    });
    const markImageOrientation = (image) => {
      const update = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        image.dataset.imageOrientation = image.naturalWidth > image.naturalHeight ? 'landscape' : 'portrait';
      };
      image.addEventListener('load', update, { once: true });
      if (image.complete) update();
    };
    const createDetailUrl = createHomeDetailUrl;
    const getPublishYear = homeContentYear;
    const getCategoryLabel = homeContentLabel;

    const getTimestamp = (item) => {
      for (const field of ['updated_at', 'published_at', 'release_date', 'publish_date', 'created_at']) {
        const timestamp = Date.parse(item?.[field] || '');
        if (Number.isFinite(timestamp)) return timestamp;
      }
      return 0;
    };

    const formatDate = (item) => {
      const timestamp = getTimestamp(item);
      return timestamp ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(timestamp) : '';
    };

    const coverLikeKeys = (item) => [getImageKey(item?.cover_url)].filter(Boolean);

    const renderCategory = (container, slots, emptyMessage) => {
      if (!container) return;
      container.replaceChildren();
      if (!slots.length) {
        setContentState(container, { message: emptyMessage });
        return;
      }

      slots.slice(0, 6).forEach((slot) => {
        const detailUrl = createDetailUrl(slot);
        if (!detailUrl) return;
        const detailImageKeys = coverLikeKeys(slot);
        const image = element('img', {
          attributes: {
            alt: slot.title ? `${slot.title}封面` : '作品封面',
            loading: 'lazy',
            decoding: 'async',
            'data-content-id': slot.id,
            'data-image-kind': 'cover',
            'data-image-index': '0',
            'data-image-url': slot.cover_url,
            'data-preview-image': '',
            'data-detail-url': detailUrl
          }
        });
        markImageOrientation(image);
        setImageSource(image, slot.cover_url, ANIME_FALLBACK);
        const card = element(
            'article',
            {
              className: 'card'
            },
            [
              element(
                'a',
                {
                  className: 'card__media',
                  attributes: { href: detailUrl, 'aria-label': `查看${slot.title || '未命名作品'}详情` }
                },
                [image, element('span', { className: 'card__open', text: '查看作品 ↗' })]
              ),
              element('div', { className: 'card__body' }, [
                element('h3', { className: 'card__title', text: slot.title || '未命名作品' }),
                element('div', { className: 'card__meta' }, [
                  element('span', { className: 'card__meta-group' }, [
                    getPublishYear(slot)
                      ? element('span', { className: 'card__year', text: getPublishYear(slot) })
                      : null,
                    element('span', { className: 'card__type', text: getCategoryLabel(slot) })
                  ]),
                  element('button', {
                    className: 'image-like-button image-like-button--inline',
                    attributes: {
                      type: 'button',
                      'data-image-like': '',
                      'data-image-like-summary-keys': JSON.stringify(detailImageKeys),
                      'aria-label': '点赞该作品',
                      'aria-pressed': 'false'
                    }
                  }, [
                    element('span', { text: '♡', attributes: { 'aria-hidden': 'true' } }),
                    element('span', { className: 'sr-only', text: '点赞', attributes: { 'data-image-like-label': '' } }),
                    element('strong', { className: 'card__like-count', text: '0', attributes: { 'data-image-like-count': '' } })
                  ])
                ])
              ])
            ]
          );
        const media = card.querySelector('.card__media');
        if (publicVideoUrl(slot.video_url)) {
          media.addEventListener('mouseenter', () => cardPreview.request(media, slot.video_url));
          media.addEventListener('focusin', () => cardPreview.request(media, slot.video_url));
          media.addEventListener('mouseleave', cardPreview.stop);
          media.addEventListener('focusout', cardPreview.stop);
        }
        container.append(card);
      });
    };

    const renderUpdates = (container, records) => {
      if (!container) return;
      const items = records.filter((item) => createDetailUrl(item)).sort((a, b) => getTimestamp(b) - getTimestamp(a)).slice(0, 6);
      if (!items.length) {
        setContentState(container, { message: '暂时没有更新内容。' });
        return;
      }
      container.replaceChildren(...items.map((item) => {
        const image = element('img', { attributes: { alt: item.title ? `${item.title}缩略图` : '作品缩略图', loading: 'lazy', decoding: 'async', width: '320', height: '180' } });
        setImageSource(image, item.cover_url, ANIME_FALLBACK);
        const text = [element('h3', { text: item.title || '未命名作品' })];
        if (item.subtitle) text.push(element('p', { text: item.subtitle }));
        const date = formatDate(item);
        if (date) text.push(element('time', { text: `${date} 更新`, attributes: { datetime: new Date(getTimestamp(item)).toISOString() } }));
        return element('a', { className: 'update-card', attributes: { href: createDetailUrl(item) } }, [element('div', { className: 'update-card__media' }, [image]), element('div', { className: 'update-card__body' }, text)]);
      }));
    };

    const renderRanking = (container, records) => {
      if (!container) return;
      const items = records.filter((item) => createDetailUrl(item)).slice(0, 5);
      if (!items.length) {
        container.replaceChildren(element('li', { className: 'content-state', text: '暂无排行数据' }));
        return;
      }
      container.replaceChildren(...items.map((item, index) => {
        const image = element('img', { attributes: { alt: '', loading: 'lazy', decoding: 'async', width: '96', height: '128' } });
        markImageOrientation(image);
        setImageSource(image, item.cover_url, ANIME_FALLBACK);
        return element('li', { className: 'ranking-item', attributes: { 'data-ranking-like-keys': JSON.stringify(coverLikeKeys(item)), 'data-ranking-order': index } }, [
          element('span', { className: `ranking-item__number ranking-item__number--${index + 1}`, text: index + 1 }),
          element('a', { className: 'ranking-item__media', attributes: { href: createDetailUrl(item), 'aria-label': `查看${item.title || '作品'}详情` } }, [image]),
          element('div', { className: 'ranking-item__body' }, [element('a', { className: 'ranking-item__title', text: item.title || '未命名作品', attributes: { href: createDetailUrl(item) } }), element('span', { className: 'ranking-item__tag', text: getCategoryLabel(item) }), element('span', { className: 'ranking-item__likes', text: '♡ 0', attributes: { 'data-ranking-like-count': '' } })])
        ]);
      }));
    };

    const renderNews = (container, records) => {
      if (!container) return;
      const items = records.filter((item) => createDetailUrl(item)).sort((a, b) => getTimestamp(b) - getTimestamp(a)).slice(0, 4);
      if (!items.length) {
        setContentState(container, { message: '暂无最新资讯。' });
        return;
      }
      container.replaceChildren(...items.map((item) => {
        const image = element('img', { attributes: { alt: '', loading: 'lazy', decoding: 'async', width: '120', height: '80' } });
        setImageSource(image, item.cover_url, ANIME_FALLBACK);
        const body = [element('h3', { text: item.title || '未命名作品' })];
        if (item.subtitle) body.push(element('p', { text: item.subtitle }));
        const date = formatDate(item);
        if (date) body.push(element('time', { text: date, attributes: { datetime: new Date(getTimestamp(item)).toISOString() } }));
        return element('a', { className: 'news-item', attributes: { href: createDetailUrl(item) } }, [image, element('div', { className: 'news-item__body' }, body)]);
      }));
    };

    const animeContainer = document.getElementById('anime-container');
    const mangaContainer = document.getElementById('manga-container');
    const updatesContainer = document.getElementById('updates-container');
    const rankingContainer = document.getElementById('ranking-container');
    const newsContainer = document.getElementById('news-container');
    if (animeContainer) setLoadingState(animeContainer, { count: 6, variant: 'card', label: '正在加载热门动漫' });
    if (mangaContainer) setLoadingState(mangaContainer, { count: 6, variant: 'card', label: '正在加载漫画连载' });

    try {
      if (!window.supabaseClient) throw new Error('内容服务尚未初始化');
      const { data: managementData, error } = await window.supabaseClient.from('content_management').select('*');
      if (error) throw error;

      const records = Array.isArray(managementData) ? managementData : [];
      const animeRecords = selectHomeContent(records, 'anime', Number.MAX_SAFE_INTEGER);
      const mangaRecords = selectHomeContent(records, 'manga', Number.MAX_SAFE_INTEGER);
      const catalogRecords = [...animeRecords, ...mangaRecords];
      const spotlight = document.querySelector('.spotlight');
      const spotlightItem = catalogRecords.find((item) => item.cover_url && createDetailUrl(item));
      if (spotlight && spotlightItem) {
        const spotlightImage = spotlight.querySelector('.spotlight__image');
        setImageSource(spotlightImage, spotlightItem.cover_url, ANIME_FALLBACK);
        spotlight.querySelector('#spotlight-title').textContent = spotlightItem.title;
        spotlight.querySelector('.spotlight__copy').textContent = spotlightItem.subtitle || getCategoryLabel(spotlightItem);
        spotlight.querySelector('.spotlight__link').href = createDetailUrl(spotlightItem);
        spotlight.hidden = false;
      }
      renderCategory(
        animeContainer,
        animeRecords,
        '暂时没有动漫推荐，稍后再来看看吧。'
      );
      renderCategory(
        mangaContainer,
        mangaRecords,
        '暂时没有漫画连载，稍后再来看看吧。'
      );
      renderUpdates(updatesContainer, catalogRecords);
      renderRanking(rankingContainer, catalogRecords);
      renderNews(newsContainer, catalogRecords);
    } catch (error) {
      console.error('主页动态数据加载失败:', error);
      [animeContainer, mangaContainer, updatesContainer, rankingContainer, newsContainer].filter(Boolean).forEach((container) => {
        setContentState(container, {
          message: '内容加载失败，请检查网络后重试。',
          kind: 'error',
          onRetry: loadHomeContent
        });
      });
    }
  }
  // ✨ 拦截器加固
  const globalTriggerModal = (event) => {
    const targetButton = event.target.closest('#user-btn');
    if (!targetButton || targetButton.textContent.includes('欢迎回来')) return;
    if (targetButton.textContent.includes('登录') || targetButton.textContent.includes('注册专区')) {
      event.preventDefault();
      event.stopPropagation();
      openModal('login');
    }
  };

  document.addEventListener('touchend', globalTriggerModal, { passive: false });
  document.addEventListener('click', globalTriggerModal);

  if (new URLSearchParams(location.search).get('auth') === 'login') {
    requestAnimationFrame(() => openModal('login'));
  } else if (new URLSearchParams(location.search).get('account') === 'profile') {
    requestAnimationFrame(() => openModal('profile'));
  }

  // 💥 唤起总初始化启动入口 💥
  initApp();
});

// =================================================================
// 🎯 终极物理破局：解决返回主页时 Supabase 挂起卡死没反应的问题
// =================================================================
window.addEventListener('pageshow', (event) => {
    const isBackAction = event.persisted || (window.performance && window.performance.navigation && window.performance.navigation.type === 2);

    if (isBackAction) {
        console.log("🔄 捕获到从后台返回的行为。为了防止旧网络套接字被浏览器冻结死锁，准备强刷整页...");
        sessionStorage.setItem('just_backed_from_admin', 'true');
        window.location.reload();
    }
});
