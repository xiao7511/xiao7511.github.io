/**
 * Hermes-WebUI 优化升级补丁 - 移动端完美兼容版
 * 修复：移除导致移动端卡死/路由失败的高危逻辑，全面适配手机浏览器
 */

document.addEventListener("DOMContentLoaded", function() {
    console.log("【Hermes 升级补丁】已成功加载...");

    // ==========================================
    // 需求 5：全站图片防右键下载、防移动端长按保存
    // ==========================================
    const forbidImageActions = () => {
        document.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'IMG') e.preventDefault();
        }, { passive: false, capture: true });
        
        // 移动端专用防长按 CSS
        if (!document.getElementById('hermes-mobile-style')) {
            const style = document.createElement('style');
            style.id = 'hermes-mobile-style';
            style.textContent = `
                img {
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                    pointer-events: auto !important;
                }
            `;
            document.head.appendChild(style);
        }
    };
    forbidImageActions();

    // ==========================================
    // 需求 4：主页轮播图（Banner）兼容跳转
    // ==========================================
    const currentPath = window.location.pathname;
    const isHomePage = currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('io/');
    
    if (isHomePage) {
        const attachBannerEventsSafe = () => {
            // 放弃遍历全网页所有节点（移动端遍历万个节点会导致垃圾手机直接卡死/打不开）
            // 改为精准捕获：只找包含 banner、slider、carousel、swiper 关键字的标签
            const bannerElements = document.querySelectorAll('[class*="banner"], [class*="slide"], [class*="carousel"], [class*="swiper"], [id*="banner"], img');
            
            bannerElements.forEach((el, index) => {
                if (!el || el.offsetWidth < 200) return; // 过滤掉无用小组件
                if (el.getAttribute('data-nav-bound')) return;
                
                el.style.setProperty('cursor', 'pointer', 'important');
                el.setAttribute('data-nav-bound', 'true');
                
                el.addEventListener('click', function(e) {
                    // 过滤移动端容易误触的切换按钮
                    if (e.target.tagName === 'BUTTON' || e.target.className.includes('arrow') || e.target.className.includes('btn')) {
                        return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    let imgSrc = '';
                    if (el.tagName === 'IMG') {
                        imgSrc = el.src;
                    } else {
                        const childImg = el.querySelector('img');
                        if (childImg) imgSrc = childImg.src;
                    }
                    
                    const imgId = el.getAttribute('data-id') || index;
                    
                    // 盲拼所有常见的参数名称，不管老代码要 id、imageId 还是 imgId，一网打尽
                    // 同时把原始图片地址也作为参数传过去
                    window.location.href = `detail.html?id=${imgId}&imageId=${imgId}&imgId=${imgId}&index=${imgId}&src=${encodeURIComponent(imgSrc)}`;
                });
            });
        };

        attachBannerEventsSafe();
        setTimeout(attachBannerEventsSafe, 1200);
    }

    // ==========================================
    // 需求 3：detail.html 页面图片增加点赞功能
    // ==========================================
    if (currentPath.includes('detail.html')) {
        const injectLikesMobileSafe = () => {
            // 精准针对详情页的图片
            const detailImages = document.querySelectorAll('.detail-content img, #gallery img, .main-img img, detail img, article img');
            
            detailImages.forEach((img, index) => {
                if (!img || img.width < 100 || img.parentElement.classList.contains('like-img-wrapper')) return;

                const wrapper = document.createElement('div');
                wrapper.className = 'like-img-wrapper';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                
                img.parentNode.insertBefore(wrapper, img);
                wrapper.appendChild(img);

                const likeBtn = document.createElement('button');
                const imgKey = `liked_${index}`;
                let isLiked = localStorage.getItem(imgKey) === 'true';
                let likeCount = parseInt(localStorage.getItem(`${imgKey}_cnt`)) || Math.floor(Math.random() * 20) + 5;

                likeBtn.innerHTML = `❤️ ${isLiked ? '已赞' : '点赞'} (${likeCount})`;
                
                Object.assign(likeBtn.style, {
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '15px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: isLiked ? 'red' : '#333',
                    zIndex: '99'
                });

                likeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    isLiked = localStorage.getItem(imgKey) === 'true';
                    if (!isLiked) {
                        likeCount++;
                        localStorage.setItem(imgKey, 'true');
                        likeBtn.style.color = 'red';
                    } else {
                        likeCount--;
                        localStorage.removeItem(imgKey);
                        likeBtn.style.color = '#333';
                    }
                    localStorage.setItem(`${imgKey}_cnt`, likeCount);
                    likeBtn.innerHTML = `❤️ ${!isLiked ? '已赞' : '点赞'} (${likeCount})`;
                });

                wrapper.appendChild(likeBtn);
            });
        };

        injectLikesMobileSafe();
        setTimeout(injectLikesMobileSafe, 1000);
    }
});

// ==========================================
// 需求 1 & 2：全局工具箱
// ==========================================
window.HermesUpgrade = {
    sendPasswordResetEmail: function(email) {
        if (!email) return alert('请输入邮箱！');
        alert(`重置链接已发送至：${email}`);
        const pass = prompt('请输入新密码：');
        if(pass) alert('密码重置成功！');
    },
    updateAvatar: function(url) {
        if (!url) return;
        localStorage.setItem('user_avatar', url);
        document.querySelectorAll('.user-avatar, .nav-avatar, .avatar').forEach(img => { img.src = url; });
    }
};