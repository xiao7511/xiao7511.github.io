<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getSupabase } from '../services/supabase';
import { requestAccountDeletion } from '../services/account';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

const CONFIRMATION = '删除我的账号';
const confirmation = ref('');
const sending = ref(false);
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const confirmed = computed(() => confirmation.value.trim() === CONFIRMATION);

async function submit(): Promise<void> {
  if (!auth.session || !confirmed.value || sending.value) return;
  sending.value = true;
  try {
    await requestAccountDeletion(await getSupabase());
    try {
      await auth.signOut();
    } catch {
      toast.show('删除请求已提交，但自动退出失败，请手动退出', 'error');
      await router.replace('/profile');
      return;
    }
    toast.show('账号删除请求已提交', 'success');
    await router.replace('/');
  } catch {
    toast.show('暂时无法提交删除请求，请联系支持', 'error');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="page listing-page trust-page">
    <button type="button" class="text-button" @click="router.back">‹ 返回账号</button>
    <div class="page-heading">
      <span class="eyebrow">ACCOUNT DELETION</span>
      <h1>删除账号</h1>
      <p>提交后服务端将处理账号与关联个人数据。社区内容可能按法律、安全和审计要求匿名化或保留。</p>
    </div>
    <section class="danger-card">
      <h2>提交前请确认</h2>
      <ul>
        <li>你将立即退出当前设备。</li>
        <li>删除完成后无法恢复登录和个人资料。</li>
        <li>如请求无法提交，请通过支持页面联系我们。</li>
      </ul>
      <form @submit.prevent="submit">
        <label
          >输入“{{ CONFIRMATION }}”确认
          <input v-model="confirmation" autocomplete="off" />
        </label>
        <button class="danger-button" type="submit" :disabled="!confirmed || sending">
          {{ sending ? '正在提交…' : '提交删除请求' }}
        </button>
      </form>
    </section>
  </div>
</template>
