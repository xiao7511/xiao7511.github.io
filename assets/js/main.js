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
  const avatarOptions = Array.from(document.querySelectorAll('.avatar-option'));

  // 新增相关的 DOM 节点获取
  const avatarFileInput = document.getElementById('reg-avatar-file');
  const avatarFileHint = document.getElementById('avatar-file-hint');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const userProfileForm = document.getElementById('user-profile-form');
  const editAvatarFileInput = document.getElementById('edit-avatar-file');
  const editAvatarHint = document.getElementById('edit-avatar-hint');

  // 论坛相关节点
  const postContent = document.getElementById('post-content');
  const publishBtn = document.getElementById('publish-btn');
  const postsList = document.getElementById('posts-list');

  const REDIRECT_URL = window.location.origin + window.location.pathname;
  let selectedAvatar = avatarOptions[0]?.dataset.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Neko';
  let carouselTimer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentSlideIndex = 0;

  // 轮播控制
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
      if (swipeDistance > 50) { prevSlide(); } else if (swipeDistance < -50) { nextSlide(); }
      startCarousel(); 
    }, { passive: true });
  }

  // 渲染底层数据流图片
  async function syncLiveImagesFromDB() {
    const fallbackImages = {
      section_banner: [
        'images/IMG_4822.jpeg', 'images/IMG_4823.jpeg', 'images/IMG_4824.jpeg', 'images/IMG_4825.jpeg', 'images/IMG_4826.jpeg'
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
        }
      }
      const buster = window.forceCacheBuster || `?t=${new Date().getTime()}`;
      carouselSlides.forEach((slide, index) => {
        const imgElement = slide.querySelector('img');
        if (imgElement) {
          if (liveUrls && liveUrls[index]) {
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

  // 载入四大板块推荐
  async function loadHomeContent() {
    const animeContainer = document.getElementById('anime-container');
    if (!animeContainer) return;
    try {
      if (!window.supabaseClient) throw new Error();
      const { data, error } = await window.supabaseClient.from('anime_recommendations').select('*').order('id', { ascending: true });
      if (error || !data || data.length === 0) throw new Error();
      animeContainer.innerHTML = '';
      data.forEach(item => {
        animeContainer.innerHTML += `
          <article class="card">
            <img src="${item.image_url}" alt="${item.title}" loading="lazy" decoding="async">
            <div class="card__body">
              <h3 class="card__title">${item.title}</h3>
              <p class="card__tag">${item.tags}</p>
            </div>
          </article>`;
      });
    } catch (e) {
      // 备用兜底静态结构
      animeContainer.innerHTML = `
        <article class="card"><img src="images/IMG_4893.png" alt="魔法少女"><div class="card__body"><h3 class="card__title">魔法少女</h3><p class="card__tag">魔法 / 冒险</p></div></article>
        <article class="card"><img src="images/IMG_4896.png" alt="校园恋爱"><div class="card__body"><h3 class="card__title">校园恋爱</h3><p class="card__tag">恋爱 / 校园</p></div></article>
        <article class="card"><img src="images/IMG_4907.png" alt="战斗冒险"><div class="card__body"><h3 class="card__title">战斗冒险</h3><p class="card__tag">热血 / 冒险</p></div></article>
        <article class="card"><img src="images/IMG_4922.png" alt="科幻机甲"><div class="card__body"><h3 class="card__title">科幻机甲</h3><p class="card__tag">科幻 / 机甲</p></div></article>`;
    }
  }

  // 占位空函数，维护原有架构对齐不报错
  async function loadDeployedSections() {}

  // ==========================================
  // 🚀 核心应用程序初始化函数
  // ==========================================
  async function initApp() {
    showSlide(0);
    startCarousel();

    try {
      const apiUri = "https://api.nobistudio.com/";
      const res = await fetch(apiUri);
      if (!res.ok) throw new Error();
      const config = await res.json();
      
      window.supabaseClient = supabase.createClient(config.SUPABASE_URL, config.ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      
      console.log("✅ Supabase 安全客户端注入成功！");

      // 并行载入全部数据层
      await Promise.all([
        syncLiveImagesFromDB(),
        loadHomeContent(),
        loadDeployedSections(),
        fetchPosts()
      ]);

      // 🎯 核心逻辑：全局认证钩子监听
      window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔑 认证状态事件: ${event}`);
        
        // ✨ 新增重置密码高光点：监测用户点击重置密码邮件链接返回的主页时机
        if (event === "PASSWORD_RECOVERY") {
          setTimeout(() => {
            const newPassword = prompt("🔒 监测到您的改密邮件验证成功！请输入您要设定的全新安全密码（至少6位）：");
            if (newPassword) {
              if (newPassword.length < 6) {
                alert("修改失败：新密码长度不能少于6位喵！");
                return;
              }
              window.supabaseClient.auth.updateUser({ password: newPassword }).then(({ error }) => {
                if (error) {
                  alert("重置密码失败: " + error.message);
                } else {
                  alert("🎉 密码重置成功！请妥善保管，并尝试使用新密码重新登录账号。");
                  runPhysicalLogout();
                }
              });
            }
          }, 500);
          return;
        }

        // 处理管理员后台及 UI 同步
        if (session && session.user) {
          updateUserUI(session.user);
          await checkAdminPermission(session);
        } else {
          updateUserUI(null);
        }
      });

    } catch (e) {
      console.warn("载入云端配置异常，拉起本地安全后备：", e);
      syncLiveImagesFromDB(); loadHomeContent(); loadDeployedSections(); fetchPosts();
    }
  }

  // 管理员鉴权核验
  async function checkAdminPermission(session) {
    const adminBtn = document.getElementById('admin-entrance-wrapper');
    if (!adminBtn) return;
    if (!session || !session.user || typeof window.supabaseClient.from !== 'function') {
        adminBtn.style.setProperty('display', 'none', 'important');
        return;
    }
    try {
        const { data: userData, error } = await window.supabaseClient
            .from('users')
            .select('is_admin')
            .eq('email', session.user.email)
            .maybeSingle();
        if (!error && userData && userData.is_admin === true) {
            adminBtn.style.setProperty('display', 'block', 'important');
        } else {
            adminBtn.style.setProperty('display', 'none', 'important');
        }
    } catch (err) {
        adminBtn.style.setProperty('display', 'none', 'important');
    }
  }

  // 模态框打开与全局切换
  window.switchMode = function(mode) {
    // 高亮标签控制
    if(tabLogin) tabLogin.classList.toggle('is-active', mode === 'login');
    if(tabReg) tabReg.classList.toggle('is-active', mode === 'reg');

    // 隐藏/显示表单族
    if(loginForm) loginForm.style.display = (mode === 'login') ? 'block' : 'none';
    if(regForm) regForm.style.display = (mode === 'reg') ? 'block' : 'none';
    if(forgotPasswordForm) forgotPasswordForm.style.display = (mode === 'reset') ? 'block' : 'none';
    if(userProfileForm) userProfileForm.style.display = (mode === 'profile') ? 'block' : 'none';
  };

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

  // 安全状态 UI 反馈
  function updateUserUI(user) {
    if (!userButton) return;
    if (user) {
      userButton.textContent = `欢迎回来, ${user.email.split('@')[0]} (个人中心)`;
      userButton.style.background = '#FF6EC7';
    } else {
      userButton.textContent = '登录/注册';
      userButton.style.background = '';
    }
  }

  // 点击顶部登录/注册/欢迎回来按钮
  if (userButton) {
    userButton.addEventListener('click', (e) => {
      e.preventDefault();
      const isLogged = userButton.textContent.indexOf('欢迎回来') !== -1;
      if (isLogged) {
        openModal('profile'); // 已登录点击拉起个人资料修改中心
        
        if (!document.getElementById('logout-link-btn')) {
          const logoutBtnHtml = `<div style="text-align:center; margin-top:20px;"><button id="logout-link-btn" type="button" style="background:none; border:none; color:rgba(255,255,255,0.4); text-decoration:underline; font-size:0.8rem; cursor:pointer;">🔮 退出当前账号</button></div>`;
          userProfileForm.insertAdjacentHTML('beforeend', logoutBtnHtml);
          document.getElementById('logout-link-btn').addEventListener('click', () => {
             if (confirm('确定要安全退出登录吗？')) runPhysicalLogout();
          });
        }
      } else {
        openModal('login');
      }
    });
  }

  // 物理退出
  async function runPhysicalLogout() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) localStorage.removeItem(key);
      }
    } catch (e) {}
    document.cookie = "is_admin=; path=/; max-age=0;";
    localStorage.removeItem('is_admin');
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    alert('已安全注销！');
    window.location.reload();
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (tabLogin) tabLogin.addEventListener('click', () => switchMode('login'));
  if (tabReg) tabReg.addEventListener('click', () => switchMode('reg'));
  if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', () => switchMode('reset'));

  // 预设头像选取
  if (avatarOptions.length > 0) {
    avatarOptions.forEach(btn => {
      btn.addEventListener('click', () => {
        avatarOptions.forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = '#FF6EC7';
        selectedAvatar = btn.dataset.avatar;
        if (avatarFileInput) avatarFileInput.value = '';
        if (avatarFileHint) avatarFileHint.textContent = '';
      });
    });
  }

  // 注册界面本地图片检测拦截
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', () => {
      if (avatarFileInput.files && avatarFileInput.files[0]) {
        const file = avatarFileInput.files[0];
        if (file.size > 2 * 1024 * 1024) {
          alert('初始文件不能超过 2MB 喵！'); avatarFileInput.value = ''; return;
        }
        avatarOptions.forEach(b => b.style.borderColor = 'transparent');
        avatarFileHint.textContent = `已选本地文件: ${file.name}`;
      }
    });
  }

  // 登录核心
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeModal();
      } catch (err) {
        alert(`登录失败: ${err.message}`);
      }
    });
  }

  // 注册核心（包含初始自定义本地头像直接上传功能支持）
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const nickname = document.getElementById('reg-nickname').value.trim() || '新漫友';
      const submitBtn = regForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在创建新角色...';

      try {
        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
          let finalAvatarUrl = selectedAvatar;

          // 核心点：判断是否在注册时附加了本地头像文件，若有则进行持久化推流
          if (avatarFileInput && avatarFileInput.files && avatarFileInput.files[0]) {
            const file = avatarFileInput.files[0];
            const fileExt = file.name.split('.').pop().toLowerCase();
            const filePath = `${data.user.id}.${fileExt}`;

            const { error: uploadError } = await window.supabaseClient.storage
              .from('avatars')
              .upload(filePath, file, { upsert: true });

            if (!uploadError) {
              const { data: publicUrlData } = window.supabaseClient.storage.from('avatars').getPublicUrl(filePath);
              finalAvatarUrl = `${publicUrlData.publicUrl}?t=${new Date().getTime()}`;
            }
          }

          // 写入 profiles 拓展信息数据表
          await window.supabaseClient.from('profiles').insert([
            { id: data.user.id, nickname, avatar_url: finalAvatarUrl }
          ]);
        }
        alert('注册成功！系统已向您的邮箱发送了激活认证链接，请验证后登录。');
        closeModal();
      } catch (err) {
        alert(`注册异常: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '创建异世界身份';
      }
    });
  }

  // =========================================================
  // 🎯 核心功能一：忘记密码——发送安全改密重置邮件链接
  // =========================================================
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const email = document.getElementById('forgot-email').value.trim();
      const submitBtn = document.getElementById('forgot-submit-btn');

      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在派送安全链接...';

      try {
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: REDIRECT_URL // 玩家在邮件中点击链接后引导回当前网页进行密码覆盖
        });
        if (error) throw error;
        alert('📬 密码重置安全链接已成功投递至您的邮箱！请查收并点击链接。');
        closeModal();
      } catch (err) {
        alert(`发送失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '发送安全引导邮件';
      }
    });
  }

  // 监听个人资料修改页本地新头像文件检测提示
  if (editAvatarFileInput && editAvatarHint) {
    editAvatarFileInput.addEventListener('change', () => {
      if (editAvatarFileInput.files && editAvatarFileInput.files[0]) {
        const file = editAvatarFileInput.files[0];
        if (file.size > 2 * 1024 * 1024) {
          alert('新头像文件大小不能超过 2MB 喵！');
          editAvatarFileInput.value = ''; editAvatarHint.textContent = ''; return;
        }
        editAvatarHint.textContent = `已锁定新文件: ${file.name}`;
      }
    });
  }

  // =========================================================
  // 🎯 核心功能二：用户登录后——异步同步上传更换自定义头像
  // =========================================================
  if (userProfileForm) {
    userProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session?.user;
      if (!user) { alert('您目前的登录态已失效，请重新登录账号。'); return; }

      if (!editAvatarFileInput.files || editAvatarFileInput.files.length === 0) {
        alert('请先点击按钮选择一张本地精美的动漫图片作为新头像！'); return;
      }

      const submitBtn = document.getElementById('update-avatar-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在覆盖云端存储...';

      try {
        const file = editAvatarFileInput.files[0];
        const fileExt = file.name.split('.').pop().toLowerCase();
        // 以 UID.后缀 格式命名，upsert:true 即可实现无限原子覆盖更新，不留冗余垃圾文件
        const filePath = `${user.id}.${fileExt}`;

        // 1. 上传至 Supabase Storage 名为 'avatars' 的公共 Bucket
        const { error: uploadError } = await window.supabaseClient.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw new Error(`云端存储桶写入受阻: ${uploadError.message} (请确保建立了名为 avatars 的存储桶并开启公共读)`);

        // 2. 捕获刚刚生成的对外公共下载直链 URL
        const { data: publicUrlData } = window.supabaseClient.storage.from('avatars').getPublicUrl(filePath);
        
        // 3. 关键点：追加强刷缓存时间戳破除浏览器边缘缓存，确保论坛、评论区立刻看到变化
        const finalAvatarUrl = `${publicUrlData.publicUrl}?t=${new Date().getTime()}`;

        // 4. 将最新地址下沉对齐更新回 profiles 数据关系表中
        const { error: profileError } = await window.supabaseClient
          .from('profiles')
          .update({ avatar_url: finalAvatarUrl })
          .eq('id', user.id);

        if (profileError) throw profileError;

        alert('🎉 恭喜你，自定义头像更换成功！社区全模组资料卡已同步。');
        editAvatarFileInput.value = '';
        editAvatarHint.textContent = '';
        closeModal();
        window.location.reload(); // 刷新网页，全面更新多态图层
      } catch (err) {
        alert(`更换头像遭遇失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '立刻同步保存新头像';
      }
    });
  }

  // ==========================================
  // 论坛核心：发布新动态
  // ==========================================
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      if (!window.supabaseClient) return;
      const content = postContent.value.trim();
      if (!content) { alert('发布内容不能为空喵！'); return; }

      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) { alert('请先登录账号再进行社区互动。'); openModal('login'); return; }

      const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
      
      const { error } = await window.supabaseClient.from('posts').insert([
        { 
          content, 
          user_id: user.id, 
          nickname: profile?.nickname || user.email.split('@')[0], 
          avatar_url: profile?.avatar_url || selectedAvatar 
        }
      ]);

      if (error) { alert(`发布动态失败: ${error.message}`); return; }
      postContent.value = '';
      await fetchPosts();
    });
  }

  // 论坛拉取与多级渲染（带评论、点赞）
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

        let htmlContent = `
          <div class="post-header" style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
            <img src="${post.avatar_url || selectedAvatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div>
              <div style="font-weight:bold; color:#FF6EC7;">${post.nickname}</div>
              <div style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${new Date(post.created_at).toLocaleString()}</div>
            </div>
          </div>
          <div class="post-body" style="font-size:0.95rem; line-height:1.6; margin-bottom:12px; white-space:pre-wrap;">${post.content}</div>
          <div class="post-actions" style="display:flex; gap:16px; font-size:0.85rem; color:rgba(255,255,255,0.6);">
            <button class="like-btn" onclick="toggleLike('${post.id}')" style="background:none; border:none; color:${isLiked?'#FF6EC7':'inherit'}; cursor:pointer;">❤️ 点赞 (${likesArray.length})</button>
            <button onclick="showReplyBox('${post.id}')" style="background:none; border:none; color:inherit; cursor:pointer;">💬 回复</button>
          </div>
          <div id="reply-box-${post.id}" style="display:none; margin-top:12px;">
            <input type="text" id="reply-input-${post.id}" placeholder="输入您的评论..." style="width:75%; padding:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff;">
            <button onclick="submitReply('${post.id}')" style="padding:6px 12px; background:#FF6EC7; border:none; color:#fff; border-radius:4px; margin-left:8px; cursor:pointer;">发送</button>
          </div>
          <div class="replies-container" style="margin-top:12px; padding-left:16px; border-left:2px solid rgba(255,110,199,0.2);">`;

        // 渲染对应的评论
        const childReplies = replies.filter(r => r.parent_id === post.id);
        childReplies.forEach(rep => {
          htmlContent += `
            <div style="margin-bottom:8px; font-size:0.88rem; background:rgba(255,255,255,0.02); padding:8px; border-radius:6px;">
              <span style="color:#FF6EC7; font-weight:bold;">${rep.nickname}:</span>
              <span style="color:rgba(255,255,255,0.9);">${rep.content}</span>
            </div>`;
        });

        htmlContent += `</div>`;
        postCard.innerHTML = htmlContent;
        postsList.appendChild(postCard);
      });
    } catch (err) {
      console.warn("读取论坛数据有误: ", err);
    }
  }

  // 论坛快捷评论与点赞支持函数绑到 window 级防止失效
  window.showReplyBox = function(id) {
    const box = document.getElementById(`reply-box-${id}`);
    if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
  };

  window.submitReply = function(postId) {
    const input = document.getElementById(`reply-input-${postId}`);
    const content = input ? input.value.trim() : '';
    if(!content) return;
    window.supabaseClient.auth.getUser().then(({ data: { user } }) => {
      if (!user) { alert('登录后方可发表回复。'); return; }
      window.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data: prof }) => {
        window.supabaseClient.from('posts').insert([
          { content, user_id: user.id, parent_id: postId, nickname: prof?.nickname || user.email.split('@')[0], avatar_url: prof?.avatar_url || selectedAvatar }
        ]).then(() => { input.value = ''; fetchPosts(); });
      });
    });
  };

  window.toggleLike = async function(postId) {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) { alert('点赞需要登录。'); return; }
    const { data: post } = await window.supabaseClient.from('posts').select('*').eq('id', postId).maybeSingle();
    let arr = post.likes_users || [];
    if (arr.includes(user.email)) { arr = arr.filter(e => e !== user.email); } else { arr.push(user.email); }
    await window.supabaseClient.from('posts').update({ likes_users: arr }).eq('id', postId);
    await fetchPosts();
  };

  // 唤起总初始化入口
  initApp();
});