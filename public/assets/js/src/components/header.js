export function renderUserHeader(button, user) {
  if (!button) return;
  button.textContent = user?.email ? `欢迎回来, ${user.email.split('@')[0]}` : '✨ 登录 / 注册专区';
}
