<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { useToastStore } from '../stores/toast';
import type { ReportReason } from '../services/community';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const community = useCommunityStore();
const toast = useToastStore();
const postId = computed(() => Number(route.params.id));
const reason = ref<ReportReason>('spam');
const details = ref('');
const sending = ref(false);

onMounted(() => {
  if (community.selected?.id !== postId.value) void community.loadPost(postId.value);
});

async function submit(): Promise<void> {
  if (!auth.session || sending.value || !Number.isInteger(postId.value)) return;
  sending.value = true;
  try {
    await community.report(postId.value, reason.value, details.value, auth.session);
    toast.show('举报已提交，我们会尽快审核', 'success');
    await router.replace(`/community/${postId.value}`);
  } catch {
    toast.show('举报提交失败，请稍后重试', 'error');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="page listing-page trust-page">
    <button type="button" class="text-button" @click="router.back">‹ 返回帖子</button>
    <div class="page-heading">
      <span class="eyebrow">REPORT</span>
      <h1>举报内容</h1>
      <p>举报会提交给 NOBI 管理员审核。请勿重复提交。</p>
    </div>
    <AppLoading v-if="community.loading" />
    <AppError v-else-if="community.error || !community.selected" :message="community.error || '帖子不存在'" />
    <form v-else class="compose-form" @submit.prevent="submit">
      <p class="report-preview">{{ community.selected.content }}</p>
      <label
        >举报原因
        <select v-model="reason">
          <option value="spam">垃圾信息或广告</option>
          <option value="harassment">骚扰或霸凌</option>
          <option value="hate">仇恨或歧视</option>
          <option value="sexual">色情内容</option>
          <option value="violence">暴力或危险内容</option>
          <option value="privacy">泄露隐私</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label
        >补充说明（可选）
        <textarea v-model="details" maxlength="500" placeholder="请描述具体问题"></textarea>
        <small>{{ details.length }} / 500</small>
      </label>
      <button class="primary-button" type="submit" :disabled="sending">
        {{ sending ? '正在提交…' : '提交举报' }}
      </button>
    </form>
  </div>
</template>
