/* CSS防盗链策略 */
body {
    user-select: none;
}

img {
    -webkit-user-drag: none;
    pointer-events: none;
}

/* JS防盗链策略 */
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});
document.addEventListener('keydown', function(e) {
    if(e.ctrlKey && (e.key === 's' || e.key === 'i' || e.key === 'c')) {
        e.preventDefault();
    }
});