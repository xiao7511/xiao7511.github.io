document.addEventListener('DOMContentLoaded', function() {
    // 动态拦截所有图片
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.style.userSelect = 'none';
        img.style.webkitUserDrag = 'none';
        img.style.pointerEvents = 'none';

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.opacity = '0';
        overlay.style.background = 'transparent';
        img.parentNode.insertBefore(overlay, img);
        img.parentNode.removeChild(img);
        overlay.appendChild(img);
    });

    // 全局拦截右键
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    // 全局拦截开发者工具快捷键
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && (e.key === 's' || e.key === 'i' || e.key === 'c' || e.key === 'F12')) {
            e.preventDefault();
        }
    });
});