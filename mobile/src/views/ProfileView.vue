<script setup lang="ts">
/* global Event, File, HTMLInputElement, URL */
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { getSupabase } from '../services/supabase';
import { avatarDisplayUrl, updateAvatar, validateAvatar } from '../services/avatar';
import AppAvatar from '../components/AppAvatar.vue';
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const pickerOpen = ref(false);
const previewOpen = ref(false);
const selectedFile = ref<File | null>(null);
const previewUrl = ref('');
const savingAvatar = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);

function releasePreview(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

function resetAvatarSelection(): void {
  releasePreview();
  selectedFile.value = null;
  previewOpen.value = false;
  if (avatarInput.value) avatarInput.value.value = '';
}

function openPhotoLibrary(): void {
  pickerOpen.value = false;
  avatarInput.value?.click();
}

function chooseAvatar(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) return;
  try {
    validateAvatar(file);
    releasePreview();
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    previewOpen.value = true;
  } catch (error) {
    input.value = '';
    toast.show(
      error instanceof Error && error.message === 'INVALID_AVATAR_SIZE'
        ? '图片不能超过 5MB'
        : '请选择 JPEG、PNG 或 WebP 图片',
      'error'
    );
  }
}

async function saveAvatar(): Promise<void> {
  if (!auth.user || !selectedFile.value || savingAvatar.value) return;
  const userId = auth.user.id;
  const file = selectedFile.value;
  const previousUrl = auth.profile?.id === userId ? auth.profile.avatar_url : null;
  savingAvatar.value = true;
  try {
    const client = await getSupabase();
    const publicUrl = await updateAvatar(client, userId, previousUrl, file);
    auth.setProfileAvatar(avatarDisplayUrl(publicUrl), userId);
    resetAvatarSelection();
    toast.show('头像已更新', 'success');
  } catch (error) {
    toast.show(
      error instanceof Error && error.message === 'PROFILE_NOT_PROVISIONED'
        ? '账户资料尚未初始化，头像暂无法保存。'
        : '头像保存失败，已保留原头像，请稍后重试',
      'error'
    );
  } finally {
    savingAvatar.value = false;
  }
}

onBeforeUnmount(releasePreview);
async function logout(): Promise<void> {
  try {
    await auth.signOut();
    toast.show('已退出登录', 'success');
    await router.replace('/');
  } catch {
    toast.show(auth.error || '退出失败', 'error');
  }
}

async function retryProfile(): Promise<void> {
  try {
    await auth.loadProfile();
  } catch {
    // The store exposes a safe profile status for a subsequent retry.
  }
}
</script>
<template>
  <div class="page listing-page">
    <div class="profile-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>个人中心</h1>
      <span aria-hidden="true"></span>
    </div>
    <div v-if="auth.user" class="profile-card profile-card--aligned">
      <div class="profile-cover" aria-hidden="true"></div>
      <button class="profile-avatar-editor" type="button" aria-label="修改头像" @click="pickerOpen = true">
        <AppAvatar
          :src="auth.profile?.avatar_url"
          :user-id="auth.user.id"
          :name="auth.profile?.nickname || auth.user.email || '用户'"
          size="large"
        />
        <span aria-hidden="true">✎</span>
      </button>
      <button class="profile-avatar-label" type="button" @click="pickerOpen = true">修改头像</button>
      <h2>{{ auth.profile?.nickname || auth.user.email?.split('@')[0] }}</h2>
      <p class="profile-email">{{ auth.user.email }}</p>
      <div v-if="auth.profileStatus === 'missing' || auth.profileStatus === 'error'" class="form-error" role="status">
        <p>{{ auth.profileStatus === 'missing' ? '账户资料尚未初始化，稍后可重试。' : '资料暂时无法加载，请检查网络后重试。' }}</p>
        <button type="button" class="text-button" @click="retryProfile">重新加载资料</button>
      </div>
      <dl>
        <div>
          <dt>UID</dt>
          <dd>{{ auth.user.id }}</dd>
        </div>
      </dl>
      <nav class="profile-menu" aria-label="账号功能">
        <RouterLink to="/community"><span>▣</span>我的帖子与社区<b>›</b></RouterLink>
        <RouterLink to="/support"><span>◎</span>消息与支持<b>›</b></RouterLink>
        <RouterLink to="/privacy"><span>⚙</span>设置与隐私<b>›</b></RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin" class="profile-admin-link"
          ><span>🛡</span>后台管理<b>›</b></RouterLink
        >
      </nav>
      <button class="secondary-button" type="button" :disabled="auth.loading" @click="logout">退出登录</button>
      <RouterLink to="/account/delete" class="profile-danger-link">删除账号</RouterLink>
    </div>
    <div v-else class="profile-card profile-card--guest">
      <AppAvatar size="large" name="NOBI" />
      <h2>欢迎来到 NOBI</h2>
      <p>登录后参与社区讨论与点赞。</p>
      <div class="button-row">
        <RouterLink to="/login" class="primary-button">登录</RouterLink
        ><RouterLink to="/register" class="secondary-button">注册</RouterLink>
      </div>
    </div>
    <nav class="profile-links" aria-label="支持与政策">
      <RouterLink to="/privacy">隐私政策</RouterLink>
      <RouterLink to="/support">支持与联系</RouterLink>
    </nav>
    <input
      ref="avatarInput"
      class="avatar-file-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      @change="chooseAvatar"
    />
    <div v-if="pickerOpen" class="sheet-backdrop" role="presentation" @click.self="pickerOpen = false">
      <section class="action-sheet" role="dialog" aria-modal="true" aria-labelledby="avatar-sheet-title">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 id="avatar-sheet-title">修改头像</h2>
        <button type="button" @click="openPhotoLibrary">从相册选择</button>
        <button type="button" class="sheet-cancel" @click="pickerOpen = false">取消</button>
      </section>
    </div>
    <div v-if="previewOpen" class="sheet-backdrop avatar-preview-backdrop" role="presentation">
      <section class="avatar-preview-sheet" role="dialog" aria-modal="true" aria-labelledby="avatar-preview-title">
        <h2 id="avatar-preview-title">预览头像</h2>
        <div class="avatar-crop-preview"><img :src="previewUrl" alt="新头像预览" /></div>
        <p>{{ selectedFile?.name }}</p>
        <div class="button-row">
          <button type="button" class="secondary-button" :disabled="savingAvatar" @click="resetAvatarSelection">
            取消
          </button>
          <button type="button" class="primary-button" :disabled="savingAvatar" @click="saveAvatar">
            {{ savingAvatar ? '保存中…' : '保存头像' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
