import { initializeSupabase } from './src/api/supabase.js';
import {
  ModerationAccessError,
  initializeModeration,
  loadAuthorizedReports,
  reviewModerationReport
} from './src/moderation/service.js';

const statusNode = document.getElementById('moderation-status');
const listNode = document.getElementById('moderation-list');
const refreshButton = document.getElementById('refresh-reports');
let client;

function setStatus(message, kind = 'info') {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function review(reportId, action, note, button) {
  button.disabled = true;
  try {
    await reviewModerationReport(client, reportId, action, note);
    setStatus('审核操作已保存。', 'success');
    await loadReports();
  } catch {
    setStatus('审核操作失败。请确认 migration、管理员权限和网络状态。', 'error');
  } finally {
    button.disabled = false;
  }
}

function renderReport(report) {
  const article = element('article', '', 'moderation-report');
  const meta = element('div', '', 'moderation-report__meta');
  meta.append(element('strong', `举报 #${report.id} · ${report.reason}`));
  meta.append(element('time', new Date(report.created_at).toLocaleString('zh-CN')));
  article.append(meta);
  article.append(element('p', report.post?.content || '原帖不可用', 'moderation-report__content'));
  if (report.details) article.append(element('p', report.details, 'moderation-report__details'));

  const label = element('label', '审核备注');
  const note = document.createElement('textarea');
  note.maxLength = 1000;
  note.placeholder = '记录判断依据（可选）';
  label.append(note);
  article.append(label);

  const actions = element('div', '', 'moderation-report__actions');
  for (const [action, labelText] of [
    ['dismiss', '驳回举报'],
    ['hide', '隐藏内容'],
    ['remove', '移除内容'],
    ['restore', '恢复内容']
  ]) {
    const button = element('button', labelText);
    button.type = 'button';
    button.dataset.action = action;
    button.addEventListener('click', () => void review(report.id, action, note.value, button));
    actions.append(button);
  }
  article.append(actions);
  return article;
}

async function loadReports() {
  refreshButton.disabled = true;
  listNode.replaceChildren();
  setStatus('正在加载待处理举报…');
  try {
    const data = await loadAuthorizedReports(client);
    if (!data?.length) {
      setStatus('当前没有待处理举报。', 'success');
      return;
    }
    for (const report of data) listNode.append(renderReport(report));
    setStatus(`待处理举报：${data.length} 条。`);
  } catch {
    setStatus('无法读取审核队列。请确认 Phase 4 migration 已部署。', 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

async function initialize() {
  refreshButton.disabled = true;
  listNode.replaceChildren();
  try {
    const initialized = await initializeModeration(initializeSupabase);
    client = initialized.client;
    refreshButton.addEventListener('click', () => void loadReports());
    listNode.replaceChildren();
    if (!initialized.reports.length) {
      setStatus('当前没有待处理举报。', 'success');
    } else {
      for (const report of initialized.reports) listNode.append(renderReport(report));
      setStatus(`待处理举报：${initialized.reports.length} 条。`);
    }
    refreshButton.disabled = false;
  } catch (error) {
    client = undefined;
    listNode.replaceChildren();
    refreshButton.disabled = true;
    if (error instanceof ModerationAccessError && error.code === 'UNAUTHENTICATED') {
      setStatus('请先在 NOBI 首页登录管理员账号，再返回此页面。', 'error');
    } else if (error instanceof ModerationAccessError && error.code === 'UNAUTHORIZED') {
      setStatus('当前账号没有内容审核权限。', 'error');
    } else if (error instanceof ModerationAccessError) {
      setStatus('无法验证管理员权限，已安全拒绝访问。', 'error');
    } else {
      setStatus('审核页面配置或网络连接不可用，请稍后重试。', 'error');
    }
  }
}

void initialize();
