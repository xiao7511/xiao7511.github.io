<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { useToastStore } from '../stores/toast';
const auth = useAuthStore();
const community = useCommunityStore();
const toast = useToastStore();
const router = useRouter();
const title = ref('');
const content = ref('');
const category = ref('交流');
const sending = ref(false);
async function submit(): Promise<void> {
  if (!auth.session || !content.value.trim()) return;
  sending.value = true;
  try {
    await community.publish(
      { title: title.value.trim(), content: content.value.trim(), category: category.value },
      auth.session,
      auth.profile
    );
    toast.show('动态发布成功', 'success');
    await router.replace('/community');
  } catch {
    toast.show('发布失败，请稍后重试', 'error');
  } finally {
    sending.value = false;
  }
}
</script>
<template>
  <div class="page listing-page">
    <button type="button" class="text-button" @click="router.back">‹ 返回</button>
    <div class="page-heading">
      <span class="eyebrow">NEW POST</span>
      <h1>发布动态</h1>
      <p>与 NOBI 社区分享你的想法</p>
    </div>
    <form class="compose-form" @submit.prevent="submit">
      <label>标题（可选）<input v-model="title" maxlength="80" /></label
      ><label
        >分类<select v-model="category">
          <option>交流</option>
          <option>新番</option>
          <option>漫画</option>
          <option>推荐</option>
        </select></label
      ><label
        >内容<textarea v-model="content" maxlength="500" required></textarea
        ><small>{{ content.length }} / 500</small></label
      ><button class="primary-button" type="submit" :disabled="sending || !content.trim()">
        {{ sending ? '发布中…' : '发布动态' }}
      </button>
    </form>
  </div>
</template>
