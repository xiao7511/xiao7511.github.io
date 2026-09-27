<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCommunityStore } from '../stores/community';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { communityWebUrl } from '../services/urls';
import { shareContent } from '../services/native';
import CommunityCard from '../components/CommunityCard.vue';
import AppAvatar from '../components/AppAvatar.vue';
import AppLoading from '../components/AppLoading.vue';
import AppError from '../components/AppError.vue';
import { getSupabase } from '../services/supabase';
import { removeReplyImage, uploadReplyImage, validateReplyImage } from '../services/reply-image';
const route = useRoute();
const router = useRouter();
const community = useCommunityStore();
const auth = useAuthStore();
const toast = useToastStore();
const replyText = ref('');
const sending = ref(false);
type BrowserFile = InstanceType<typeof globalThis.File>;
interface FileInputTarget {
  files?: { [index: number]: BrowserFile | undefined };
  value: string;
}
const replyImage = ref<BrowserFile | null>(null);
const replyPreview = ref('');
const confirmingBlock = ref(false);
const blocking = ref(false);
const postId = computed(() => Number(route.params.id));
const canActOnAuthor = computed(() =>
  Boolean(community.selected?.user_id && community.selected.user_id !== auth.user?.id)
);
onMounted(() => {
  if (Number.isInteger(postId.value) && postId.value > 0) void community.loadPost(postId.value);
});
async function like(): Promise<void> {
  if (!auth.session) {
    await router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  try {
    await community.toggleLike(postId.value, auth.session);
  } catch {
    toast.show('点赞失败，状态已恢复', 'error');
  }
}
async function share(): Promise<void> {
  if (!community.selected) return;
  try {
    await shareContent(
      community.selected.title || 'NOBI 社区动态',
      communityWebUrl(),
      community.selected.content.slice(0, 100)
    );
    toast.show('分享内容已准备好', 'success');
  } catch {
    toast.show('分享失败', 'error');
  }
}
async function submitReply(): Promise<void> {
  const content = replyText.value.trim();
  if (!content && !replyImage.value) return;
  if (!auth.session) {
    await router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  sending.value = true;
  let uploaded: { path: string; url: string } | null = null;
  try {
    if (replyImage.value) uploaded = await uploadReplyImage(await getSupabase(), auth.session.user.id, replyImage.value);
    await community.reply(postId.value, content, auth.session, auth.profile, uploaded?.path ?? null);
    replyText.value = '';
    clearReplyImage();
    toast.show('回复已发布', 'success');
  } catch {
    if (uploaded) await removeReplyImage(await getSupabase(), uploaded.path).catch(() => undefined);
    toast.show('回复发布失败', 'error');
  } finally {
    sending.value = false;
  }
}
function chooseReplyImage(event: unknown): void {
  const input = (event as { target?: FileInputTarget }).target;
  if (!input) return;
  const file = input.files?.[0];
  if (!file) return;
  try {
    validateReplyImage(file);
    clearReplyImage();
    replyImage.value = file;
    replyPreview.value = globalThis.URL.createObjectURL(file);
  } catch (cause) {
    input.value = '';
    toast.show(cause instanceof Error && cause.message === 'INVALID_IMAGE_SIZE' ? '图片不能超过 5MB' : '仅支持 JPEG、PNG、WebP', 'error');
  }
}
function clearReplyImage(): void {
  if (replyPreview.value) globalThis.URL.revokeObjectURL(replyPreview.value);
  replyPreview.value = '';
  replyImage.value = null;
}
onBeforeUnmount(clearReplyImage);
async function blockAuthor(): Promise<void> {
  const authorId = community.selected?.user_id;
  if (!authorId) return;
  if (!auth.session) {
    await router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  if (!confirmingBlock.value) {
    confirmingBlock.value = true;
    return;
  }
  blocking.value = true;
  try {
    await community.blockUser(authorId, auth.session);
    toast.show('已屏蔽该用户', 'success');
    await router.replace('/community');
  } catch {
    toast.show('屏蔽失败，请稍后重试', 'error');
  } finally {
    blocking.value = false;
  }
}
function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
</script>
<template>
  <div class="page listing-page post-detail">
    <button type="button" class="text-button" @click="router.back">‹ 返回社区</button
    ><AppLoading v-if="community.loading" /><AppError
      v-else-if="community.error || !community.selected"
      :message="community.error || '帖子不存在'"
      @retry="community.loadPost(postId)"
    /><template v-else
      ><CommunityCard
        :post="community.selected"
        :pending="community.pendingLikes[postId]"
        @like="like"
        @share="share"
      />
      <div v-if="canActOnAuthor" class="safety-actions" aria-label="社区安全操作">
        <RouterLink :to="`/community/${postId}/report`" class="text-button">举报内容</RouterLink>
        <button type="button" class="text-button text-button--danger" :disabled="blocking" @click="blockAuthor">
          {{ confirmingBlock ? '再次点击确认屏蔽' : '屏蔽此用户' }}
        </button>
        <button v-if="confirmingBlock" type="button" class="text-button" @click="confirmingBlock = false">取消</button>
      </div>
      <section class="reply-section">
        <h2>评论 {{ community.replies.length }}</h2>
        <form class="reply-form" @submit.prevent="submitReply">
          <textarea v-model="replyText" maxlength="500" placeholder="写下你的回复" aria-label="回复内容"></textarea
          ><div v-if="replyPreview" class="reply-image-preview"><img :src="replyPreview" alt="待上传图片预览" /><button type="button" aria-label="移除图片" @click="clearReplyImage">×</button></div>
          <div class="reply-form__actions"><label class="secondary-button reply-image-picker">添加图片<input type="file" accept="image/jpeg,image/png,image/webp" @change="chooseReplyImage" /></label>
          <button class="primary-button" type="submit" :disabled="sending || (!replyText.trim() && !replyImage)">
            {{ sending ? '发送中…' : '发送回复' }}
          </button></div>
        </form>
        <div v-if="community.replies.length" class="reply-list">
          <article v-for="reply in community.replies" :key="reply.id">
            <AppAvatar :src="reply.avatar_url" :name="reply.nickname || '社区用户'" />
            <div>
              <header>
                <strong>{{ reply.nickname || '社区用户' }}</strong
                ><time :datetime="reply.created_at">{{ formatTime(reply.created_at) }}</time>
              </header>
              <p v-if="reply.content">{{ reply.content }}</p>
              <img v-if="reply.image_url" class="reply-image" :src="reply.image_url" alt="回复图片" loading="lazy" />
            </div>
          </article>
        </div>
        <p v-else class="state-message">还没有评论</p>
      </section></template
    >
  </div>
</template>
