// 🌟 1. 全局配置与安全业务实例声明 (收拢为唯一入口)
window.sysConfig = null;
window.supabaseClient = null; 

document.addEventListener('DOMContentLoaded', () => {
  // 🎯 【必须加在最顶端第一行】检查是否是刚才后退回来触发的全新刷新
  if (sessionStorage.getItem('just_backed_from_admin') === 'true') {
      console.log("✨ 成功通过物理重载复苏主页！正在擦除信号并强制清除缓存...");
      sessionStorage.removeItem('just_backed_from_admin'); // 立即销毁标记，防止以后F5刷新被误伤
      
      // 💡 黑科技：往全局 url 配置里塞一个时间戳参数，强制后续所有 Supabase 图片查询都带上最新时间戳破除缓存
      window.forceCacheBuster = `?t=${new Date().getTime()}`;
  }

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

  //const REDIRECT_URL = 'https://xiao7511.github.io/index.html';
  const REDIRECT_URL = 'https://www.nobistudio.com/index.html';
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

      // 🎯 核心修复：提取全局的时间戳参数，如果没有，默认生成一个普通的，确保每次返回都是最新的
      const buster = window.forceCacheBuster || `?t=${new Date().getTime()}`;

      carouselSlides.forEach((slide, index) => {
        const imgElement = slide.querySelector('img');
        if (imgElement) {
          if (liveUrls && liveUrls[index]) {
            // ⚡ 拼接缓存击穿时间戳，强制浏览器向 Supabase 重新下载新图
            const rawUrl = liveUrls[index];
            imgElement.src = rawUrl.includes('?') ? `${rawUrl}&_cb=${new Date().getTime()}` : rawUrl + buster;
          } else {
            imgElement.src = fallbackImages.section_banner[index] || imgElement.src;
          }
        }
      });
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
      const apiUri = "https://api.nobistudio.com/";
      const res = await fetch(apiUri);
      if (!res.ok) throw new Error(`Cloudflare 边缘节点异常: ${res.status}`);
      
      const config = await res.json();
      if (!config.SUPABASE_URL || !config.ANON_KEY) {
        throw new Error("云端载入的通信凭证不完整。");
      }

      // 创建客户端
      window.supabaseClient = supabase.createClient(config.SUPABASE_URL, config.ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      
      console.log("✅ Supabase 安全客户端已成功注入底座！");

      // 🎯 核心修复 1：无论登录与否，立即采用 Promise.all 并发拉取全部图片、四大区域以及论坛列表！
      // 彻底避开身份恢复（onAuthStateChange）时产生的底层网络死锁，让页面从后退中瞬间复活
      try {
        await Promise.all([
          syncLiveImagesFromDB(),   // 刷新轮播图
          loadHomeContent(),         // 刷新动态推荐板块
          loadDeployedSections(),   // 📺 读取部署数据并无缝对齐四大区域逻辑功能（确保不损坏原有功能）
          fetchPosts()              // 🚀 唤醒并并行加载论坛帖子列表
        ]);
        console.log("📊 站点基础版面、多媒体图层与论坛数据流并行同步完成！");
      } catch (innerErr) {
        console.error("数据流局部渲染受阻，正在继续保障认证链路:", innerErr);
      }

      // 🎯 核心修复 2：解耦身份监听状态。内部严禁做任何阻塞式高频操作，保证论坛状态与控制台不掉线
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log(`🔑 认证状态变更事件触发: ${event}`);
        if (session && session.user) {
          updateUserUI(session.user);
        } else {
          updateUserUI(null);
        }
      });

    } catch (e) {
      console.warn("未能通过云端拉取配置，启动本地安全后备：", e);
      syncLiveImagesFromDB();
      loadHomeContent();
      loadDeployedSections();
      fetchPosts();
    }
  }

  // =========================================================
  // 🎯 鉴权核心函数
  // =========================================================
  async function checkAdminPermission(session) {
    updateUserUI(session?.user || null);

    const adminBtn = document.getElementById('admin-entrance-wrapper') || document.getElementById('admin-btn');
    if (!adminBtn) return;

    if (!session || !session.user) {
        adminBtn.style.setProperty('display', 'none', 'important');
        return;
    }

    if (typeof window.supabaseClient.from !== 'function') {
        adminBtn.style.setProperty('display', 'none', 'important');
        return;
    }

    try {
        const { data: userData, error } = await window.supabaseClient
            .from('users')
            .select('is_admin')
            .eq('email', session.user.email)
            .maybeSingle();

        if (error) {
            console.error("Supabase 鉴权发生底层错误:", error.message);
            adminBtn.style.setProperty('display', 'none', 'important');
            return;
        }

        if (userData && userData.is_admin === true) {
            adminBtn.style.setProperty('display', 'block', 'important');
            console.log(`👑 管理员权限核验通过: [${session.user.email}]`);
        } else {
            adminBtn.style.setProperty('display', 'none', 'important');
        }
    } catch (err) {
        console.error('审查管理员权限时发生异常:', err);
        adminBtn.style.setProperty('display', 'none', 'important');
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

  // ==========================================
  // 🎯 论坛全新架构：Fetch 帖子与二级树状评论渲染
  // ==========================================
  async function fetchPosts() {
    if (!postsList) return;
    
    try {
      const { data: allPosts, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      postsList.innerHTML = '';
      
      const mainPosts = allPosts.filter(p => !p.parent_id);
      const replies = allPosts.filter(p => p.parent_id);

      mainPosts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.style = "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding:16px; border-radius:12px; margin-bottom:16px;";

        const currentEmail = window.supabaseClient.auth.currentUser?.email || '';
        const likesArray = post.likes_users || [];
        const isLiked = likesArray.includes(currentEmail);
        const likeCount = likesArray.length;

        let htmlContent = `
          <div class="post-header" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <img src="${post.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=Neko'}" style="width:32px; height:32px; border-radius:50%;" />
            <div>
              <div style="font-weight:bold; font-size:0.9rem;">${post.nickname || '神秘漫友'}</div>
              <div style="font-size:0.7rem; color:rgba(255,255,255,0.4);">${new Date(post.created_at).toLocaleString()}</div>
            </div>
          </div>
          <div class="post-body" style="font-size:0.95rem; margin-bottom:12px; white-space: pre-wrap;">${post.content}</div>
          
          <div class="post-actions" style="display:flex; gap:16px; font-size:0.8rem;">
            <button class="like-action-btn" data-post-id="${post.id}" style="background:none; border:none; color:${isLiked ? '#ff4757' : 'rgba(255,255,255,0.6)'}; cursor:pointer; font-weight:bold; outline:none;">
              ${(isLiked || likeCount > 0) ? '❤️ 已赞' : '🤍 点赞'} (${likeCount})
            </button>
            <button onclick="showReplyBox('${post.id}')" style="background:none; border:none; color:#00f5ff; cursor:pointer; font-weight:bold; outline:none;">
              💬 回复
            </button>
          </div>

          <div id="replies-container-${post.id}" style="margin-top:12px; padding-left:12px; border-left:2px solid rgba(0,245,255,0.2); gap:8px; display:flex; flex-direction:column;">
        `;

        const currentReplies = replies.filter(r => r.parent_id === post.id);
        currentReplies.forEach(reply => {
          htmlContent += `
            <div class="reply-item" style="background: rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px; font-size:0.85rem;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <img src="${reply.avatar_url}" style="width:20px; height:20px; border-radius:50%;" />
                <span style="font-weight:bold; color:#ffe066;">${reply.nickname}</span>
                <span style="font-size:0.7rem; color:rgba(255,255,255,0.3);">${new Date(reply.created_at).toLocaleTimeString()}</span>
              </div>
              <div style="color:rgba(255,255,255,0.85);">${reply.content}</div>
            </div>
          `;
        });

        htmlContent += `
          </div>
          <div id="reply-box-${post.id}" style="display:none; margin-top:12px; gap:8px;">
            <input type="text" id="reply-input-${post.id}" placeholder="写下你的精彩回复..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 12px; border-radius:6px; font-size:0.85rem; outline:none;" />
            <button onclick="submitReply('${post.id}')" style="background:linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color:#fff; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600;">发送</button>
          </div>
        `;

        postCard.innerHTML = htmlContent;
        postsList.appendChild(postCard);

        const likeBtn = postCard.querySelector('.like-action-btn');
        if (likeBtn) {
          likeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            await window.toggleLike(post.id, likesArray);
          });
        }
      });
    } catch (err) {
      console.error("加载论坛卡死:", err);
    }
  }

  window.toggleLike = async function(postId, currentLikes) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const user = session?.user;

    if (!user) {
      alert("请先登录再参与社区点赞互动哦！");
      return;
    }

    let updatedLikes = Array.isArray(currentLikes) ? [...currentLikes] : [];
    if (updatedLikes.includes(user.email)) {
      updatedLikes = updatedLikes.filter(email => email !== user.email);
    } else {
      updatedLikes.push(user.email);
    }

    try {
      const { error } = await window.supabaseClient
        .from('posts')
        .update({ likes_users: updatedLikes })
        .eq('id', postId);

      if (error) {
        console.error("数据库拒绝了点赞更新:", error);
        alert(`点赞失败，数据库返回: ${error.message} (代码: ${error.code})`);
        return;
      }
      
      await fetchPosts(); 
    } catch(err) {
      console.error("网络或流阻断:", err);
    }
  };

  window.showReplyBox = function(postId) {
    const box = document.getElementById(`reply-box-${postId}`);
    if (box) {
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
      if (box.style.display === 'flex') {
        document.getElementById(`reply-input-${postId}`).focus();
      }
    }
  };

  window.submitReply = async function(postId) {
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
  };

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
    if (!userButton) return;
    
    // 获取后台控制入口按钮元素（兼容代码中出现的两种 ID 命名）
    let adminButton = document.getElementById('admin-entrance-wrapper') || document.getElementById('admin-btn');
    
    if (user) {
      // (1) 瞬间渲染并点亮前端用户登录状态（零延迟响应）
      userButton.innerHTML = `<span class="user-status-dot"></span> 欢迎回来, ${user.email.split('@')[0]}`;
      userButton.style.background = 'rgba(255, 255, 255, 0.15)';
      
      // (2) 🚀 瞬间无缝唤醒论坛：全物理接触隐藏，彻底防止论坛处于断开或僵尸挂起状态
      if (postArea) {
        postArea.removeAttribute('hidden');
        postArea.style.display = 'block'; 
      }
      if (publishBtn) publishBtn.removeAttribute('disabled');

      // (3) 🎯 异步低优先级隔离：将可能引起死锁挂起的 `users` 表鉴权延迟 200ms 执行
      setTimeout(async () => {
        if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
          console.warn("⚠️ 实例尚在复苏，略过本次静默验权。");
          return;
        }
        
        try {
          console.log("🔍 正在后台静默校验管理员身份凭证...");
          const { data, error } = await window.supabaseClient
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle(); // 健壮处理，防止无记录时产生致命脚本异常

          if (!error && data && data.is_admin) {
            console.log("👑 认证成功：当前账号具备最高管理权限，正在呈现控制台入口...");
            
            // 补写安全通信锁双向 Cookie
            document.cookie = "is_admin=true; path=/; max-age=86400; SameSite=Lax";
            document.cookie = "admin_access=true; path=/; max-age=86400; SameSite=Strict";
            
            // 展现控制台按钮入口
            if (adminButton) {
              adminButton.removeAttribute('hidden');
              adminButton.style.setProperty('display', 'block', 'important');
            } else {
              // 如果 DOM 中没有预设，则动态自动在用户区右侧补上
              if (!document.getElementById('admin-btn-dynamic')) {
                const adminBtnHtml = `<a href="admin.html" id="admin-btn-dynamic" class="nav-btn admin-special-btn" style="margin-left: 10px; background: #ff4757; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; font-weight: bold;">⚙️ 管理后台</a>`;
                userButton.insertAdjacentHTML('afterend', adminBtnHtml);
              }
            }
          } else {
            // 如果查出来不是管理员，安全清理所有的残留锁
            document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
            document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            removeAdminButton();
          }
        } catch (authCatch) {
          console.warn("静默验权通道暂时繁忙，已安全降级跳过:", authCatch);
        }
      }, 200); 

    } else {
      // (4) 用户未登录或退出登录时，全面物理还原界面并封锁论坛发布功能
      clearUserUI();
      document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      removeAdminButton();
    }

    // 辅助工具：安全解除管理按钮
    function removeAdminButton() {
      if (adminButton) {
        adminButton.setAttribute('hidden', 'true');
        adminButton.style.setProperty('display', 'none', 'important');
      }
      const dynamicBtn = document.getElementById('admin-btn-dynamic');
      if (dynamicBtn) dynamicBtn.remove();
    }
  }

  // 负责退出登录或未登录时的界面复原
  function clearUserUI() {
     if (userButton) {
        userButton.innerHTML = '✨ 登录 / 注册专区';
        userButton.style.background = '';
     }
     if (postArea) {
        postArea.setAttribute('hidden', '');
        postArea.style.display = 'none';
     }
     if (publishBtn) publishBtn.setAttribute('disabled', 'true');
  }

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

  // ==========================================
  // 📺 前台核心：从 site_config 表读取部署数据并无缝对齐四大区域
  // ==========================================
  async function loadDeployedSections() {
      console.log("⚡ 正在从 site_config 路由表拉取最新版面部署数据...");
      try {
          if (!window.supabaseClient) {
              console.warn("Supabase 客户端未初始化，延迟加载版面...");
              return;
          }

          const { data: configs, error } = await window.supabaseClient
              .from('site_config')
              .select('section, url');

          if (error) {
              console.error("拉取前台版面配置失败:", error);
              return;
          }

          if (!configs || configs.length === 0) {
              console.log("💡 暂无任何版面部署记录，保持前台默认静态占位。");
              return;
          }

          configs.forEach(cfg => {
              const sectionId = cfg.section;
              let imageUrls = [];
              
              try {
                  imageUrls = typeof cfg.url === 'string' ? JSON.parse(cfg.url) : cfg.url;
              } catch (e) {
                  console.error(`解析区域 [${sectionId}] 的 URL 数组失败:`, e);
                  return;
              }

              if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;

              switch (sectionId) {
                  case 'section_banner':
                      const bannerContainer = document.getElementById('banner-slider') || document.querySelector('.swiper-wrapper'); 
                      if (bannerContainer) {
                          bannerContainer.innerHTML = imageUrls.map(url => `
                              <div class="swiper-slide">
                                  <img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" />
                              </div>
                          `).join('');
                      }
                      break;

                  case 'section_anime':
                      const animeContainer = document.getElementById('anime-section-grid') || document.querySelector('.anime-grid');
                      if (animeContainer) {
                          animeContainer.innerHTML = imageUrls.map((url, idx) => `
                              <div class="anime-card" style="border-radius:8px; overflow:hidden;">
                                  <img src="${url}" style="width:100%; display:block;" />
                                  <div class="anime-title" style="padding:8px; font-size:0.85rem; text-align:center;">动漫热播推荐 ${idx + 1}</div>
                              </div>
                          `).join('');
                      }
                      break;

                  case 'section_community':
                      const commContainer = document.getElementById('community-section-images') || document.querySelector('.community-banners');
                      if (commContainer) {
                          commContainer.innerHTML = imageUrls.map(url => `
                              <div class="community-banner-item">
                                  <img src="${url}" style="width:100%; border-radius:6px;" />
                              </div>
                          `).join('');
                      }
                      break;

                  case 'section_recommend':
                      const recommendContainer = document.getElementById('recommend-section-cards') || document.querySelector('.recommend-grid');
                      if (recommendContainer) {
                          recommendContainer.innerHTML = imageUrls.map((url, idx) => `
                              <div class="recommend-card-item">
                                  <img src="${url}" style="width:100%; border-radius:10px; border:1px solid rgba(255,255,255,0.1);" />
                              </div>
                          `).join('');
                      }
                      break;

                  default:
                      console.warn(`未知的版面标识符: ${sectionId}`);
              }
          });

          console.log("🎉 前台四大板块已全部无缝查表对齐并动态刷新完成！");

          if (window.mySwiperInstance && typeof window.mySwiperInstance.update === 'function') {
              window.mySwiperInstance.update();
          }

      } catch (globalErr) {
          console.error("前台同步对齐发生严重阻断:", globalErr);
      }
  }

  async function loadHomeContent() {
      try {
          if (!window.supabaseClient) return;
          const { data: managementData, error } = await window.supabaseClient
              .from('content_management')
              .select('*');

          if (error || !managementData) return;

          const buster = window.forceCacheBuster || `?t=${new Date().getTime()}`;

          const animeContainer = document.getElementById('anime-container');
          if (animeContainer) {
              animeContainer.innerHTML = '';
              const animeSlots = managementData
                  .filter(item => item.category === 'anime')
                  .sort((a, b) => a.slot_index - b.slot_index);

              animeSlots.forEach(slot => {
                  const card = document.createElement('article');
                  card.className = 'card';
                  card.style.cursor = 'pointer';
                  card.onclick = () => {
                      window.location.href = `detail.html?category=${slot.category}&slot=${slot.slot_index}`;
                  };
                  
                  const finalCover = slot.cover_url 
                      ? (slot.cover_url.includes('?') ? `${slot.cover_url}&_cb=${new Date().getTime()}` : slot.cover_url + buster)
                      : 'placeholder.png';
                  
                  card.innerHTML = `
                      <img src="${finalCover}" loading="lazy" decoding="async"/>
                      <div class="card__body">
                        <h3 class="card__title">${slot.title}</h3>
                        <p class="card__tag">${slot.subtitle}</p>
                      </div>
                  `;
                  animeContainer.appendChild(card);
              });
          }

          const mangaContainer = document.getElementById('manga-container');
          if (mangaContainer) {
              mangaContainer.innerHTML = '';
              const mangaSlots = managementData
                  .filter(item => item.category === 'manga')
                  .sort((a, b) => a.slot_index - b.slot_index);

              mangaSlots.forEach(slot => {
                  const card = document.createElement('article');
                  card.className = 'card';
                  card.style.cursor = 'pointer';
                  card.onclick = () => {
                      window.location.href = `detail.html?category=${slot.category}&slot=${slot.slot_index}`;
                  };
                  
                  const finalCover = slot.cover_url 
                      ? (slot.cover_url.includes('?') ? `${slot.cover_url}&_cb=${new Date().getTime()}` : slot.cover_url + buster)
                      : 'placeholder.png';
                  
                  card.innerHTML = `
                      <img src="${finalCover}" loading="lazy" decoding="async"/>
                      <div class="card__body">
                        <h3 class="card__title">${slot.title}</h3>
                        <p class="card__tag">${slot.subtitle}</p>
                      </div>
                  `;
                  mangaContainer.appendChild(card);
              });
          }

      } catch (err) {
          console.error("主页动态数据加载失败:", err);
      }
  }

  // ✨ 拦截器加固
  const globalTriggerModal = (e) => {
    const targetBtn = e.target.closest('#user-btn');
    if (!targetBtn) return;

    if (targetBtn.textContent.includes('欢迎回来')) {
      return;
    }

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

  let currentSlideIndexOld = 0;
  let carouselSlidesOld = Array.from(document.querySelectorAll('.hero__slide'));
  function showSlideOld(idx) {
    if (!carouselSlidesOld.length) return;
    carouselSlidesOld.forEach(s => s.classList.remove('is-active'));
    let target = idx;
    if (idx >= carouselSlidesOld.length) target = 0;
    if (idx < 0) target = carouselSlidesOld.length - 1;
    currentSlideIndexOld = target;
    carouselSlidesOld[currentSlideIndexOld].classList.add('is-active');
  }

  const prevBtn = document.querySelector('.hero__btn--prev');
  const nextBtn = document.querySelector('.hero__btn--next');
  if (prevBtn) prevBtn.onclick = () => showSlideOld(currentSlideIndexOld - 1);
  if (nextBtn) nextBtn.onclick = () => showSlideOld(currentSlideIndexOld + 1);

  if (carouselSlidesOld.length > 0) {
    setInterval(() => showSlideOld(currentSlideIndexOld + 1), 6000);
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