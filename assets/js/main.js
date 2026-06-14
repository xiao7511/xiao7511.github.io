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
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const userProfileForm = document.getElementById('user-profile-form');
  const editAvatarFileInput = document.getElementById('edit-avatar-file');
  const editAvatarHint = document.getElementById('edit-avatar-hint');

  // 初始化模态框切换
  if (tabLogin) {
    tabLogin.onclick = () => openModal('login');
  }
  if (tabReg) {
    tabReg.onclick = () => openModal('reg');
  }
  if (modalClose) {
    modalClose.onclick = () => closeModal();
  }

  window.openModal = function(type = 'login') {
    if (!modal) return;
    modal.classList.add('is-active');
    
    // 隐藏所有表单
    if (loginForm) loginForm.hidden = true;
    if (regForm) regForm.hidden = true;
    if (resetForm) resetForm.hidden = true;
    if (forgotPasswordForm) forgotPasswordForm.hidden = true;
    if (userProfileForm) userProfileForm.hidden = true;

    // 隐藏 Tab 头（在重置、忘记密码、个人中心页面不需要显示登录/注册切换标签）
    const authTabs = document.querySelector('.auth-tabs');
    if (authTabs) authTabs.style.display = (type === 'login' || type === 'reg') ? 'flex' : 'none';

    if (type === 'login' && loginForm) {
      loginForm.hidden = false;
      if (tabLogin) tabLogin.classList.add('is-active');
      if (tabReg) tabReg.classList.remove('is-active');
    } else if (type === 'reg' && regForm) {
      regForm.hidden = false;
      if (tabReg) tabReg.classList.add('is-active');
      if (tabLogin) tabLogin.classList.remove('is-active');
    } else if (type === 'forgot' && forgotPasswordForm) {
      forgotPasswordForm.hidden = false;
    } else if (type === 'reset' && resetForm) {
      resetForm.hidden = false;
    } else if (type === 'profile' && userProfileForm) {
      userProfileForm.hidden = false;
    }
  };

  window.closeModal = function() {
    if (!modal) return;
    modal.classList.remove('is-active');
  };

  // 核心逻辑总入口
  async function initApp() {
    if (!window.sysConfig || !window.sysConfig.SUPABASE_URL || !window.sysConfig.SUPABASE_ANON_KEY) {
      console.error("🚨 安全证书校验未通过，Supabase 引擎被迫挂起。");
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      console.error("🚨 核心 SDK 库加载失败，请检查网络链路是否被拦截。");
      return;
    }

    // 🔒 沿用并恢复您原有的非明文动态初始化机制
    window.supabaseClient = window.supabase.createClient(
      window.sysConfig.SUPABASE_URL,
      window.sysConfig.SUPABASE_ANON_KEY
    );

    // 监听全局认证状态变动
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log(`🔑 认证状态变更事件触发: ${event}`);
      
      if (event === "PASSWORD_RECOVERY") {
        setTimeout(() => {
          openModal('reset');
        }, 400);
      }
      
      if (session && session.user) {
        updateUserUI(session.user);
      } else {
        updateUserUI(null);
      }
    });

    // 读取初始会话
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session && session.user) {
      updateUserUI(session.user);
    } else {
      updateUserUI(null);
    }
    
    // 初始化论坛系统
    if (typeof initForum === 'function') {
        initForum();
    }
  }

  // 根据登录态更新 UI 顶栏及操作面板
  async function updateUserUI(user) {
    if (!userButton) return;
    if (user) {
      let avatarUrl = localStorage.getItem('user_avatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=Doris';
      
      try {
        const { data, error } = await window.supabaseClient
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
          
        if (!error && data) {
          if (data.avatar_url) {
            avatarUrl = data.avatar_url;
            localStorage.setItem('user_avatar', avatarUrl);
          }
          userButton.innerHTML = `
            <div class="user-profile-trigger" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <img src="${avatarUrl}" alt="头像" class="user-avatar-img" style="width:32px; height:32px; border-radius:50%; border:2px solid #FF6EC7; object-fit:cover;">
              <span class="user-name-txt" style="color:#FFF; font-size:0.9rem; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${data.username || '神秘漫友'}</span>
            </div>
          `;
          
          // 点击顶栏已登录头像，直接拉起个人资料修改中心
          const trigger = userButton.querySelector('.user-profile-trigger');
          if (trigger) {
            trigger.onclick = () => openModal('profile');
          }
          return;
        }
      } catch (e) {
        console.warn("获取个性化 profile 异常:", e);
      }

      userButton.innerHTML = `
        <div class="user-profile-trigger" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <img src="${avatarUrl}" alt="头像" class="user-avatar-img" style="width:32px; height:32px; border-radius:50%; border:2px solid #FF6EC7; object-fit:cover;">
          <span class="user-name-txt" style="color:#FFF; font-size:0.9rem;">我的账户</span>
        </div>
      `;
      const trigger = userButton.querySelector('.user-profile-trigger');
      if (trigger) {
        trigger.onclick = () => openModal('profile');
      }
    } else {
      userButton.innerHTML = `
        <button class="nav__user-btn" aria-label="用户登录注册">
          <svg class="nav__icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
      `;
      userButton.onclick = () => openModal('login');
    }
  }

  // 物理强力安全熔断注销
  window.runPhysicalLogout = async function() {
      if (!window.supabaseClient) return;
      try {
          localStorage.clear();
          sessionStorage.clear();
          await window.supabaseClient.auth.signOut();
          alert("✨ 登录态已安全注销，期待您的下次归来！");
          window.location.reload();
      } catch (err) {
          console.error("注销异常:", err);
          window.location.reload();
      }
  };

  // 绑定原生登录表单提交
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;
      
      const email = loginForm.querySelector('input[type="email"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 安全身份鉴权中...';

      try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeModal();
      } catch (err) {
        alert(`登录失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 绑定原生注册表单提交 (支持基础默认头像选择与图片注册级预载)
  let selectedRegAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=Doris";
  const avatarOptions = document.querySelectorAll('.avatar-option');
  avatarOptions.forEach(opt => {
    opt.onclick = () => {
      avatarOptions.forEach(o => o.classList.remove('is-active'));
      opt.classList.add('is-active');
      selectedRegAvatar = opt.getAttribute('data-avatar');
    };
  });

  const regAvatarFileInput = document.getElementById('reg-avatar-file');
  const avatarFileHint = document.getElementById('avatar-file-hint');
  if (regAvatarFileInput && avatarFileHint) {
    regAvatarFileInput.onchange = () => {
      if (regAvatarFileInput.files && regAvatarFileInput.files[0]) {
        avatarFileHint.textContent = `已选自定义图片: ${regAvatarFileInput.files[0].name}`;
        selectedRegAvatar = "CUSTOM_FILE";
      }
    };
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const submitBtn = regForm.querySelector('button[type="submit"]');

      if (!username) {
        alert('请输入漫友昵称哦！');
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在构建角色凭证...';

      try {
        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) throw error;

        const user = data.user;
        if (user) {
          let finalAvatarUrl = selectedRegAvatar;

          if (selectedRegAvatar === "CUSTOM_FILE" && regAvatarFileInput.files && regAvatarFileInput.files[0]) {
            const file = regAvatarFileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}.${fileExt}`;

            const { error: uploadError } = await window.supabaseClient.storage
              .from('avatars')
              .upload(filePath, file, { upsert: true });

            if (!uploadError) {
              const { data: urlData } = window.supabaseClient.storage.from('avatars').getPublicUrl(filePath);
              finalAvatarUrl = urlData.publicUrl;
            }
          }

          const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .insert([{ id: user.id, username: username, avatar_url: finalAvatarUrl }]);

          if (profileError) throw profileError;
          localStorage.setItem('user_avatar', finalAvatarUrl);
        }

        alert('🎉 账号构建成功！欢迎来到 DorisY 动漫世界！');
        closeModal();
      } catch (err) {
        alert(`注册失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 绑定点击邮件跳转回来的全新独立重置新密码表单
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const password = document.getElementById('new-password').value;
      if (!password || password.length < 6) {
        alert('密码长度不能少于 6 位数哦！');
        return;
      }

      const submitBtn = document.getElementById('reset-submit-btn') || resetForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在加密同步新密码...';

      try {
        const { error } = await window.supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        
        alert('🎉 密码修改成功！安全凭证已成功对齐，请使用新密码登录。');
        closeModal();
        await runPhysicalLogout();
      } catch (err) {
        alert(`修改密码失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 原生旧版轮播图后备控制器逻辑
  let currentSlideIndexOld = 0;
  const carouselSlidesOld = Array.from(document.querySelectorAll('.hero__slide'));
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

  // ==============================================================================
  // 🎯 【本次需求功能】: 个人中心全端头像实时覆盖与登录后密码直接修改
  // ==============================================================================
  
  // 1. 本地选择文件交互限制与大小防线校验 (2MB限制)
  if (editAvatarFileInput && editAvatarHint) {
    editAvatarFileInput.addEventListener('change', () => {
      if (editAvatarFileInput.files && editAvatarFileInput.files[0]) {
        const file = editAvatarFileInput.files[0];
        if (file.size > 2 * 1024 * 1024) {
          alert('头像文件大小不能超过 2MB 喵！');
          editAvatarFileInput.value = '';
          editAvatarHint.textContent = '';
          return;
        }
        editAvatarHint.textContent = `已选择: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }
    });
  }

  // 2. 个人中心表单提交处理（支持全端头像更新、已登录密码直接更改、击穿历史论坛头像缓存）
  if (userProfileForm) {
    userProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const user = session?.user;
      if (!user) {
        alert('登录状态已失效，请重新登录账户哦！');
        return;
      }

      const submitBtn = document.getElementById('update-profile-submit-btn') || userProfileForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '保存';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏱️ 正在同步更新中...';
      }

      try {
        let hasChanges = false;

        // 【优化一】: 用户已登录状态下，直接在输入框修改新密码
        const profileNewPwd = document.getElementById('profile-new-password')?.value;
        if (profileNewPwd) {
          if (profileNewPwd.length < 6) {
            throw new Error('新密码长度不能少于 6 位数哦！');
          }
          const { error: pwdError } = await window.supabaseClient.auth.updateUser({ password: profileNewPwd });
          if (pwdError) throw pwdError;
          hasChanges = true;
        }

        // 【优化二】: PC与移动端头像无缝覆盖上传 + 时间戳击穿全站历史发帖头像缓存
        if (editAvatarFileInput && editAvatarFileInput.files && editAvatarFileInput.files.length > 0) {
          const file = editAvatarFileInput.files[0];
          const fileExt = file.name.split('.').pop().toLowerCase();
          const filePath = `${user.id}.${fileExt}`; 

          // 通过 upsert: true 进行覆盖式物理上传
          const { error: uploadError } = await window.supabaseClient.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

          if (uploadError) throw new Error(`头像存储网关同步失败: ${uploadError.message}`);

          // 获取云端公共直链
          const { data: publicUrlData } = window.supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);

          // ✨ 时间戳破缓存：通过向公共外链强行注入动态时间戳参数，
          // 彻底摧毁浏览器对同名头像图片的本地死缓存，强迫全站历史发布的论坛帖子在重载页面时向服务器重新要图。
          const finalAvatarUrl = `${publicUrlData.publicUrl}?t=${new Date().getTime()}`;

          // 更新公共 profiles 用户关联数据表
          const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .update({ avatar_url: finalAvatarUrl })
            .eq('id', user.id);

          if (profileError) throw new Error(`同步公共资料表失败: ${profileError.message}`);

          // 更新本地临时存储
          localStorage.setItem('user_avatar', finalAvatarUrl);
          hasChanges = true;
        }

        if (!hasChanges) {
          alert('您当前没有做任何资料改动哦~');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
          return;
        }

        alert('🎉 个人设置同步成功！正在为您重新加载全端多媒体视图...');
        
        const pwdInput = document.getElementById('profile-new-password');
        if (pwdInput) pwdInput.value = '';
        if (editAvatarFileInput) editAvatarFileInput.value = '';
        if (editAvatarHint) editAvatarHint.textContent = '';
        
        closeModal();
        
        // 重新加载页面。全站历史帖子的头像会因绑定了最新时间戳的 `avatar_url` 而瞬间无缝统一更新。
        window.location.reload();

      } catch (err) {
        alert(`修改遇到异常失败: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // ==============================================================================
  // 🎯 【本次需求功能】: 未登录状态下“忘记密码”邮件投递绑定
  // ==============================================================================
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.supabaseClient) return;

      const email = document.getElementById('forgot-email').value.trim();
      const submitBtn = document.getElementById('forgot-submit-btn');
      if (!email) return;

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏱️ 正在投递加密链接...';

      try {
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;

        alert('📬 密码重置邮件已成功投递！请前往您的注册邮箱查收并点击链接修改。');
        closeModal();
      } catch (err) {
        alert(`邮件发送失败: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
    
    const backBtn = document.getElementById('back-to-login-from-forgot');
    if (backBtn) {
      backBtn.onclick = (e) => { 
        e.preventDefault(); 
        openModal('login'); 
      };
    }
  }

  // 💥 唤起总初始化启动入口 💥
  initApp();
});

// =================================================================
// 🎯 终极物理破局：解决返回主页时 Supabase 挂起卡死没反应的问题
// =================================================================
window.addEventListener('pageshow', (event) => {
    const isBackAction = event.persisted || (window.performance && window.performance.navigation.type === 2);
    if (isBackAction) {
        console.log("🔄 检测到后退/前进导航历史行为，正在执行多媒体应用层强力脱水苏醒...");
        sessionStorage.setItem('just_backed_from_admin', 'true');
        window.location.reload();
    }
});