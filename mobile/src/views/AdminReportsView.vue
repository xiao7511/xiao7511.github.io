<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import { useToastStore } from '../stores/toast';
import { fetchPendingReports, reviewReport, type AdminReport } from '../services/admin';
import { getSupabase } from '../services/supabase';

const router = useRouter();
const toast = useToastStore();
const reports = ref<AdminReport[]>([]);
const loading = ref(true);
const error = ref('');
const pendingId = ref(0);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    reports.value = await fetchPendingReports(await getSupabase());
  } catch {
    error.value = '无法读取审核队列。';
  } finally {
    loading.value = false;
  }
}

async function review(report: AdminReport, action: 'dismiss' | 'hide' | 'remove' | 'restore'): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = report.id;
  try {
    await reviewReport(await getSupabase(), report.id, action);
    reports.value = reports.value.filter((item) => item.id !== report.id);
    toast.show('审核操作已保存', 'success');
  } catch {
    toast.show('审核失败', 'error');
  } finally {
    pendingId.value = 0;
  }
}

onMounted(load);
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>举报审核</h1>
      <span aria-hidden="true"></span>
    </header>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <p v-else-if="!reports.length" class="admin-empty">当前没有待处理举报。</p>
    <div v-else class="admin-list">
      <article v-for="report in reports" :key="report.id" class="admin-report-card">
        <div class="admin-card-heading">
          <strong>举报 #{{ report.id }} · {{ report.reason }}</strong
          ><time>{{ new Date(report.created_at).toLocaleString('zh-CN') }}</time>
        </div>
        <p>{{ report.post?.content || '原帖不可用' }}</p>
        <small v-if="report.details">{{ report.details }}</small>
        <div class="admin-actions">
          <button type="button" :disabled="Boolean(pendingId)" @click="review(report, 'dismiss')">驳回</button>
          <button type="button" :disabled="Boolean(pendingId)" @click="review(report, 'hide')">隐藏</button>
          <button type="button" :disabled="Boolean(pendingId)" @click="review(report, 'remove')">移除</button>
          <button type="button" :disabled="Boolean(pendingId)" @click="review(report, 'restore')">恢复</button>
        </div>
      </article>
    </div>
  </div>
</template>
