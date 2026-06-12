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

  // ==========================================
  // 1. 增强型应用程序初始化函数
  // ==========================================
  async function initApp() {
    showSlide(0);
    startCarousel();

    if (typeof supabase === 'undefined') {
      console.error("Supabase SDK 尚未加载，中断初始化。");
      return;
    }

    // 从 Cookie 中同步秒读管理员状态（0毫秒延迟，彻底防止按钮闪现或消失）
    const isAdminCookie = document.cookie.split('; ').find(row => row.startsWith('is_admin='));
    const isAdmin = isAdminCookie ? isAdminCookie.split('=')[1] === 'true' : false;
    
    const adminBtn = document.getElementById('admin-entrance-wrapper');
    if (adminBtn) {
      if (isAdmin) {
        adminBtn.style.setProperty('display', 'block', 'important');
      } else {
        adminBtn.style.setProperty('display', 'none', 'important');
      }
    }

    const workerUrl = 'https://api.nobistudio.com/';
    let config = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(workerUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        config = await response.json();
        window.sysConfig = config;
      } else {
        throw new Error();
      }
    } catch (e) {
    }

    window.supabaseClient = supabase.createClient(config.SUPABASE_URL.trim(), config.ANON_KEY.trim(), {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // 🎯 使用标准状态广播流：同步状态到 Cookie 并处理权限
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth 状态变更流:", event);
      
      if (session && session.user) {
        updateUserUI(session.user);
        
        // 异步去验权，一旦确认为管理员，立即补写 Cookie 锁死状态
        try {
          const { data, error } = await window.supabaseClient
            .from('users')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();
            
          if (data && data.is_admin) {
            document.cookie = "is_admin=true; path=/; max-age=86400; SameSite=Lax";
            if (adminBtn) adminBtn.style.setProperty('display', 'block', 'important');
          } else {
            document.cookie = "is_admin=false; path=/; max-age=0; SameSite=Lax";
            if (adminBtn) adminBtn.style.setProperty('display', 'none', 'important');
          }
        } catch (err) {
          console.error("级联验权失败:", err);
        }
      } else {
        // 清退逻辑
        updateUserUI(null);
        document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
        if (adminBtn) adminBtn.style.setProperty('display', 'none', 'important');
      }
    });

    await syncLiveImagesFromDB();
    await fetchPosts();
    // 在你的前台主页加载完毕、且 supabaseClient 握手成功后，立刻调用它：
    await loadDeployedSections();
    await loadHomeContent();
  }

  // =========================================================
  // 🎯 鉴权核心函数
  // =========================================================
  async function checkAdminPermission(session) {
    updateUserUI(session?.user || null);

    const adminBtn = document.getElementById('admin-entrance-wrapper');
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
        // 无论是初始化会话、登录、还是凭证刷新，统一交由核心函数审查
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
  /*======================================================
  if (userButton) {
    userButton.addEventListener('click', async (e) => {
      // 🎯 核心加固：100% 掐断冒泡和捕获，不给最底部的全局拦截器任何卡死它的机会
      e.preventDefault();
      e.stopPropagation();

      // 改为更安全的精准包含判断，防止二次渲染的 innerHTML 小图标破坏文本
      const isLogged = userButton.textContent.indexOf('欢迎回来') !== -1;

      if (isLogged) {
        if (confirm('确定要退出登录吗？')) {
          console.log("正在执行退出流...");
          
          // 先同步强制清除本地的一切缓存与状态，防止网络挂起
          localStorage.clear();
          sessionStorage.clear();
          document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
          
          try {
            if (window.supabaseClient && window.supabaseClient.auth) {
              // 加上 1 秒限时，防止 signOut() 的云端网络请求无声卡死
              await Promise.race([
                window.supabaseClient.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
              ]);
            }
          } catch (signOutErr) {
            console.warn("云端注销略有延迟，已平滑跳过:", signOutErr);
          }

          alert('已安全退出登录！');
          window.location.reload(); // 强刷整洁页面
        }
      } else {
        openModal('login');
      }
    });
  }*/
  if (userButton) {
      userButton.addEventListener('click', async (e) => {
        // 1. 彻底掐断事件冒泡，防止任何全局拦截器的干扰
        e.preventDefault();
        e.stopPropagation();

        // 2. 精准包含判定
        const isLogged = userButton.textContent.indexOf('欢迎回来') !== -1;

        if (isLogged) {
          if (confirm('确定要退出登录吗？')) {
            console.log("启动终极物理熔断退出流...");
            
            // 🎯【核心改良】：在页面强刷前，物理抹除 Supabase 官方的一切本地 Token 残留
            // 这样可以彻底打断重新载入时的自动无感登录链条
            try {
              // 扫描并定点清除所有以 sb- 开头的 Supabase 官方凭证
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-')) {
                  localStorage.removeItem(key);
                }
              }
            } catch (clearErr) {
              console.warn("清洗官方缓存略有异常:", clearErr);
            }

            // 清除咱们自己的自定义管理和用户缓存
            document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax";
            localStorage.removeItem('is_admin');
            localStorage.removeItem('user_nickname');
            localStorage.removeItem('user_avatar');
            sessionStorage.clear();
            
            try {
              if (window.supabaseClient && window.supabaseClient.auth) {
                // 异步通知云端注销（限时 1 秒，超时不候）
                await Promise.race([
                  window.supabaseClient.auth.signOut(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                ]);
              }
            } catch (signOutErr) {
              console.warn("云端注销略有延迟，本地已物理断开:", signOutErr);
            }

            alert('已安全退出登录！');
            // 🎯 强行跳转回纯净的主页根路径，彻底洗净一切后台路由和时序残留
            window.location.href = window.location.origin + window.location.pathname;
          }
        } else {
          // 未登录状态，正常唤起登录弹窗
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
  // 🎯 论坛全新架构：Fetch 帖子与二级树状评论渲染（点赞防拦截加固版）
  // ==========================================
  async function fetchPosts() {
    if (!postsList) return;
    
    try {
      // 一次性查出所有主贴和回复，并按时间正序排列
      const { data: allPosts, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      postsList.innerHTML = '';
      
      // 1. 分离主贴和回复
      const mainPosts = allPosts.filter(p => !p.parent_id);
      const replies = allPosts.filter(p => p.parent_id);

      // 2. 依次渲染主贴和它附属的二级回复
      mainPosts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.style = "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding:16px; border-radius:12px; margin-bottom:16px;";

        // 检查当前登录用户是否点过赞
        const currentEmail = window.supabaseClient.auth.currentUser?.email || '';
        const likesArray = post.likes_users || [];
        const isLiked = likesArray.includes(currentEmail);
        const likeCount = likesArray.length;

        // 拼接主贴 DOM 骨架 (注意：把 button 上的 onclick 移除了，改用 class 进行精准绑定)
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

        // 找出属于这条主贴的所有二级回复并渲染
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

        // 闭合容器并拼接动态回复输入框
        htmlContent += `
          </div>
          <div id="reply-box-${post.id}" style="display:none; margin-top:12px; gap:8px;">
            <input type="text" id="reply-input-${post.id}" placeholder="写下你的精彩回复..." style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 12px; border-radius:6px; font-size:0.85rem; outline:none;" />
            <button onclick="submitReply('${post.id}')" style="background:linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color:#fff; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600;">发送</button>
          </div>
        `;

        postCard.innerHTML = htmlContent;
        postsList.appendChild(postCard);

        // 🎯 【核心加固点】：动态绑定点赞点击，死死拦截冒泡，避开一切外部全局拦截器！
        const likeBtn = postCard.querySelector('.like-action-btn');
        if (likeBtn) {
          likeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // 💥 切断冒泡，让全局智能拦截器变成瞎子
            
            // 安全触发更新，直接传入 post 对象，完美避开 JSON.stringify 引号截断 Bug
            await window.toggleLike(post.id, likesArray);
          });
        }
      });
    } catch (err) {
      console.error("加载论坛卡死:", err);
    }
  }

  // ==========================================
  // 🎯 论坛加固：点赞安全判别（带报错监控版）
  // ==========================================
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
        // 🎯 核心监控：如果数据库报错（比如因 RLS 策略拒绝），这里会直接弹窗告诉你原因！
        console.error("数据库拒绝了点赞更新:", error);
        alert(`点赞失败，数据库返回: ${error.message} (代码: ${error.code})`);
        return;
      }
      
      // 成功后重新拉取
      await fetchPosts(); 
    } catch(err) {
      console.error("网络或流阻断:", err);
    }
  };

  // 唤起特定帖子的回复输入框
  window.showReplyBox = function(postId) {
    const box = document.getElementById(`reply-box-${postId}`);
    if (box) {
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
      if (box.style.display === 'flex') {
        document.getElementById(`reply-input-${postId}`).focus();
      }
    }
  };

  // ==========================================
  // 🎯 论坛加固：提交二级评论回复
  // ==========================================
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
      // 勾兑昵称与头像
      const nickname = localStorage.getItem('user_nickname') || user.email.split('@')[0];
      const avatarUrl = localStorage.getItem('user_avatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=Neko';

      const { error } = await window.supabaseClient
        .from('posts')
        .insert([{
          content: input.value.trim(),
          nickname: nickname,
          avatar_url: avatarUrl,
          parent_id: postId // 牢牢绑定父级 ID
        }]);

      if (error) throw error;
      input.value = '';
      await fetchPosts(); // 重新加载盖楼树状图
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

  // 启动应用
  initApp();

  // ✨ 拦截器加固：只有处于登出状态、且点击了包含特定文案的按钮时才拦截弹窗
  // 全局智能拦截器 (修改后的防死锁版)
  const globalTriggerModal = (e) => {
    const targetBtn = e.target.closest('#user-btn');
    if (!targetBtn) return;

    // 🎯 核心加固：如果按钮文本里已经包含了“欢迎回来”，说明是登录态，全局拦截器直接放行，绝不强弹窗或干扰
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

          // 1. 一次性从 site_config 表中捞取所有区域的部署配置
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

          // 2. 依次遍历并动态对齐四大区域
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

              // 🎯 针对四大不同的板块进行精准的前台 DOM 元素打通与无损拼接
              switch (sectionId) {
                  
                  // 🔹 板块 1：首页 Banner 大图轮播区
                  case 'section_banner':
                      // 假设你的首页轮播容器 ID 是 banner-slider 或类似的名字
                      const bannerContainer = document.getElementById('banner-slider') || document.querySelector('.swiper-wrapper'); 
                      if (bannerContainer) {
                          // 动态拼装轮播图的 HTML 结构（保留你原有的样式类名，这里以标准的 Swiper/Slider 为例）
                          bannerContainer.innerHTML = imageUrls.map(url => `
                              <div class="swiper-slide">
                                  <img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" />
                              </div>
                          `).join('');
                      }
                      break;

                  // 🔹 板块 2：动漫版面轮播区
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

                  // 🔹 板块 3：社区交流轮播区
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

                  // 🔹 板块 4：热门强推卡牌轮播区
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

          // 💡 温馨提示：如果你的首页使用了 Swiper 等轮播图组件，渲染完后需要手动重新初始化一下
          if (window.mySwiperInstance && typeof window.mySwiperInstance.update === 'function') {
              window.mySwiperInstance.update();
          }

      } catch (globalErr) {
          console.error("前台同步对齐发生严重阻断:", globalErr);
      }
  }

    async function loadHomeContent() {
      try {
          if (!window.supabaseClient) {
              console.warn("SupabaseClient 尚未就绪，跳过内容渲染。");
              return;
          }

          // 1. 获取新版复合内容数据（热门动漫与漫画连载）
          const { data: managementData, error } = await window.supabaseClient
              .from('content_management')
              .select('*');

          if (error) throw error;
          if (!managementData) return;

          // 2. 渲染“热门动漫推荐”区域
          const animeContainer = document.getElementById('anime-container');
          if (animeContainer) {
              animeContainer.innerHTML = ''; // 清空原本写死的 4 个占位 HTML

              // 过滤出动漫的数据(anime)，并按槽位 0,1,2,3 升序排序
              const animeSlots = managementData
                  .filter(item => item.category === 'anime')
                  .sort((a, b) => a.slot_index - b.slot_index);

              animeSlots.forEach(slot => {
                  // 创建最外层卡片 article
                  const card = document.createElement('article');
                  card.className = 'card'; // 🌟 沿用你主页原本的卡片样式类名
                  card.style.cursor = 'pointer';
                  
                  // 点击后携带参数安全跳转到详情页
                  card.onclick = () => {
                      window.location.href = `detail.html?category=${slot.category}&slot=${slot.slot_index}`;
                  };

                  // 拼接标签：如果是多标签数组，用 / 隔开
                  const tagsText = (slot.theme_tags || []).join(' / ');
                  
                  // 🌟 精准无损地复刻你 HTML 原始的 DOM 结构
                  card.innerHTML = `
                      <img src="${slot.cover_url || 'images/IMG_4893.png'}" alt="${slot.title || '动漫主题'}" loading="lazy" decoding="async">
                      <div class="card__body">
                        <h3 class="card__title">${slot.title || '未命名主题'}</h3>
                        <p class="card__tag">${tagsText || slot.subtitle || '暂无分类'}</p>
                      </div>
                  `;
                  animeContainer.appendChild(card);
              });
          }

          // 3. 【同理修复】如果你以后要开放底部的漫画连载区动态化，确保 HTML 里有 id="manga-container"
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
                  
                  card.innerHTML = `
                      <img src="${slot.cover_url || 'placeholder.png'}" loading="lazy" decoding="async"/>
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

  document.addEventListener('touchend', globalTriggerModal, { passive: false });
  document.addEventListener('click', globalTriggerModal);
});