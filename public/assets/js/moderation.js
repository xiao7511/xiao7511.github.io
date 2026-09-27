import { initializeSupabase } from './src/api/supabase.js';

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
    const { error } = await client.rpc('review_post_report', {
      p_report_id: reportId,
      p_action: action,
      p_note: note.trim() || null
    });
    if (error) throw error;
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
    const { data, error } = await client
      .from('post_reports')
      .select('id,post_id,reason,details,status,created_at,post:posts(content,nickname,user_id,moderation_status)')
      .in('status', ['pending', 'reviewing'])
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;
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
  try {
    client = await initializeSupabase();
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setStatus('请先在 NOBI 首页登录管理员账号，再返回此页面。', 'error');
      return;
    }
    const { data: profile, error } = await client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (error || profile?.is_admin !== true) {
      setStatus('当前账号没有内容审核权限。', 'error');
      return;
    }
    refreshButton.addEventListener('click', () => void loadReports());
    await loadReports();
  } catch {
    setStatus('审核页面初始化失败。', 'error');
  }
}

void initialize();
