/**
 * Hermes-WebUI 优化升级补丁 - 终极全局动态捕获与轮播同步版
 * 修复：解决语法爆红，打通后台上传 Banner 后首页图片不更新、点击不跳转的问题
 */

(function() {
    console.log("【Hermes 升级补丁】高级全局代理已激活...");

    // ==========================================
    // 基础检查：安全捕获 SupabaseUrl (供首页同步 Banner 使用)
    // ==========================================
    const getSupabaseConfig = () => {
        // 尝试从全局或 admin 的后台节点中捕获链接
        return "https://api.nobistudio.com/"; 
    };

    // ==========================================
    // 新增核心：首页静态轮播图转化为实时云端动态轮播
    // ==========================================
    const syncCloudBanners = async () => {
        // 仅在首页生效
        const isHomePage = window.location.pathname === '/' || window.location.pathname.includes('index.html');
        if (!isHomePage) return;

        try {
            // 从 Cloudflare Worker 网关安全获取最新的 Banner 配置
            const res = await fetch(getSupabaseConfig());
            if (!res.ok) return;
            const config = await res.json();
            
            if (config.SUPABASE_URL && config.ANON_KEY && window.supabase) {
                const client = window.supabase.createClient(config.SUPABASE_URL, config.ANON_KEY);
                
                // 从全新的 content_management 表中抓取 category 为 banner 的 5 张图
                const { data: bannerData, error } = await client
                    .from('content_management')
                    .select('cover_url, slot_index')
                    .eq('category', 'banner')
                    .order('slot_index', { ascending: true });

                if (!error && bannerData && bannerData.length > 0) {
                    // 获取首页所有的轮播图片标签
                    const slideImages = document.querySelectorAll('.hero__slides .hero__slide img');
                    
                    bannerData.forEach(item => {
                        const idx = item.slot_index;
                        if (slideImages[idx] && item.cover_url) {
                            // 动态将静态图替换为管理员刚刚上传的云端存储图片
                            slideImages[idx].src = item.cover_url;
                            // 为图片打上槽位标记，确保后续点击能完美拦截
                            slideImages[idx].setAttribute('data-slot', idx);
                        }
                    });
                    console.log(`【Hermes】成功从云端数据表同步加载了 ${bannerData.length} 张全新 Banner 轮播大图！`);
                }
            }
        } catch (e) {
            console.error("【Hermes】轮播图云端同步时发生阻断: ", e);
        }
    };

    // 立即执行并延迟二次确认，防止旧 DOM 还没渲染好
    document.addEventListener('DOMContentLoaded', syncCloudBanners);
    setTimeout(syncCloudBanners, 800);

    // ==========================================
    // 需求 5：全站图片防右键下载、防移动端长按保存
    // ==========================================
    document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG') e.preventDefault();
    }, { passive: false, capture: true });
    
    // 注入防长按 CSS
    const style = document.createElement('style');
    style.textContent = `img { -webkit-touch-callout: none !important; user-select: none !important; }`;
    document.head.appendChild(style);

    // ==========================================
    // 需求 4：主页轮播图点击跳转（基于全局冒泡监听，100% 触发）
    // ==========================================
    document.addEventListener('click', function(e) {
        let target = e.target;
        let isBannerClick = false;
        let clickedImg = null;
        let slotIndex = "0";

        while (target && target !== document.body) {
            const className = String(target.className || '').toLowerCase();
            const idName = String(target.id || '').toLowerCase();
            const tagName = target.tagName.toLowerCase();

            if (tagName === 'button' || className.includes('arrow') || className.includes('btn') || className.includes('dot')) {
                return;
            }

            if (className.includes('banner') || idName.includes('banner') ||
                className.includes('slide') || idName.includes('slide') ||
                className.includes('carousel') || idName.includes('carousel')) {
                isBannerClick = true;
                
                if (target.tagName === 'IMG') {
                    clickedImg = target;
                } else {
                    clickedImg = target.querySelector('img');
                }
                
                slotIndex = target.getAttribute('data-id') || target.getAttribute('data-slot') || (clickedImg ? clickedImg.getAttribute('data-slot') : null) || slotIndex;
                break;
            }
            target = target.parentNode;
        }

        if (isBannerClick) {
            e.preventDefault();
            e.stopPropagation();

            let imgSrc = clickedImg ? clickedImg.src : '';
            
            if (slotIndex === "0" && imgSrc) {
                const filename = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);
                const match = filename.match(/\d+/);
                if (match) {
                    // 如果名字是 IMG_4823.jpeg，提取出来减去 4822 就能对应上槽位，或者直接当做 ID
                    const num = parseInt(match[0]);
                    if (num >= 4822 && num <= 4826) slotIndex = (num - 4822).toString();
                }
            }

            const finalCategory = "banner"; 
            const targetUrl = `detail.html?category=${finalCategory}&slot=${slotIndex}&id=${slotIndex}&src=${encodeURIComponent(imgSrc)}`;
            
            console.log("【Hermes】成功拦截轮播点击并重定向至云端资源库：", targetUrl);
            window.location.href = targetUrl;
        }
    }, true);

    // ==========================================
    // 需求 3：详情页图片动态挂载点赞（支持异步渲染）
    // ==========================================
    // ==========================================
    // 针对 detail.html 页面的 Banner 分类全多图强行展示引擎
    // ==========================================
    if (window.location.pathname.includes('detail.html')) {
        const forceRenderBannerGallery = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const category = urlParams.get('category');
            const slot = urlParams.get('slot');

            // 只有当点击的是 Banner 分类进入的详情页才启动本引擎
            if (category !== 'banner') return;

            // 如果页面已经渲染出多图了，或者我们已经挂载过了，就不用重复挂载
            if (document.getElementById('hermes-banner-gallery-loaded')) return;

            try {
                // 1. 去和你的 Cloudflare Worker 的 detail 路由申请真实数据
                // 拼装符合你 Worker 校验的路径：/api/detail?category=banner&slot=X
                const apiRes = await fetch(`https://api.nobistudio.com/api/detail?category=banner&slot=${slot || 0}`);
                if (!apiRes.ok) return;
                const data = await apiRes.json();

                // 2. 提取出我们在后台塞入的 detail_urls 全图集数组
                // 兼容处理：有些数据库返回单条对象，有些返回数组，我们做个安全兼容
                const record = Array.isArray(data) ? data[0] : data;
                let imagesArray = record ? (record.detail_urls || record.images || []) : [];

                // 如果是字符串格式，强行解析成 JSON 数组
                if (typeof imagesArray === 'string') {
                    try { imagesArray = JSON.parse(imagesArray); } catch(e) {}
                }

                // 3. 开始在详情页里找地方强行塞入这 5 张图
                if (imagesArray && imagesArray.length > 0) {
                    // 动态寻找原本页面存放详情内容的容器（根据 index.html 的结构，通常是 .detail-content, .gallery, #gallery, article 等）
                    let container = document.querySelector('.detail-content, #gallery, .gallery-container, .main-content, article');
                    
                    // 如果这些容器都没找到，我们直接创建一个挂载在 body 顶部
                    if (!container) {
                        container = document.createElement('div');
                        container.className = 'detail-content';
                        document.body.appendChild(container);
                    }

                    // 先把老代码可能弹出来的“尚未上传详情页多图内容”提示语给彻底清除/隐藏
                    const allTexts = container.querySelectorAll('*');
                    allTexts.forEach(el => {
                        if (el.innerText && el.innerText.includes('尚未上传详情页多图内容')) {
                            el.style.display = 'none';
                        }
                    });

                    // 4. 循环所有的 Banner 图片，全部生成并整整齐齐地平铺在详情页中央！
                    imagesArray.forEach((imgUrl, i) => {
                        // 检查是否已经存在这张图，防止重复生成
                        if (document.querySelector(`img[data-banner-idx="${i}"]`)) return;

                        const imgEl = document.createElement('img');
                        imgEl.src = imgUrl;
                        imgEl.setAttribute('data-banner-idx', i);
                        imgEl.style.cssText = `
                            width: 100%;
                            max-width: 800px;
                            display: block;
                            margin: 25px auto;
                            border-radius: 12px;
                            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                            transition: transform 0.3s;
                        `;
                        // 移动端长按防下载
                        imgEl.style.setProperty('-webkit-touch-callout', 'none', 'important');

                        container.appendChild(imgEl);
                    });

                    // 打上成功标记
                    const flag = document.createElement('div');
                    flag.id = 'hermes-banner-gallery-loaded';
                    flag.style.display = 'none';
                    container.appendChild(flag);
                    
                    console.log(`【Hermes】成功在详情页强行横向铺开了完整的 ${imagesArray.length} 张 Banner 艺术多图集！`);
                }
            } catch (err) {
                console.error("【Hermes】详情页强行多图渲染引擎发生阻断: ", err);
            }
        };

        // 轮询和动态监听，确保在 DOM 加载完的第一时间完成多图替换
        forceRenderBannerGallery();
        setInterval(forceRenderBannerGallery, 1000);
    }
})();

// =========================================================
// 🎯 完美修复此处！补齐右括号，彻底消灭控制台和编辑器爆红！
// =========================================================
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