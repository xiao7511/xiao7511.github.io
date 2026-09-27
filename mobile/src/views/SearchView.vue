<script setup lang="ts">
import { ref } from 'vue';
import { searchAll, type SearchResults } from '../services/search';
import ContentCard from '../components/ContentCard.vue';
import CommunityCard from '../components/CommunityCard.vue';
import AppAvatar from '../components/AppAvatar.vue';
import AppLoading from '../components/AppLoading.vue';

const query = ref('');
const loading = ref(false);
const error = ref('');
const results = ref<SearchResults | null>(null);

async function submit(): Promise<void> {
  if (query.value.trim().length < 2) return;
  loading.value = true;
  error.value = '';
  try {
    results.value = await searchAll(query.value);
  } catch {
    error.value = '搜索失败，请检查网络后重试。';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page listing-page search-page">
    <div class="page-heading"><span class="eyebrow">SEARCH</span><h1>搜索</h1></div>
    <form class="global-search" role="search" @submit.prevent="submit">
      <input v-model="query" type="search" minlength="2" placeholder="搜索动漫、漫画、帖子或用户" aria-label="搜索" />
      <button class="primary-button" type="submit" :disabled="loading || query.trim().length < 2">搜索</button>
    </form>
    <AppLoading v-if="loading" />
    <p v-else-if="error" class="state-message">{{ error }}</p>
    <template v-else-if="results">
      <section v-if="results.content.length" class="content-section">
        <h2>动漫与漫画</h2><div class="card-grid library-grid"><ContentCard v-for="item in results.content" :key="item.id" :item="item" /></div>
      </section>
      <section v-if="results.posts.length" class="content-section">
        <h2>帖子</h2><div class="feed-list"><CommunityCard v-for="post in results.posts" :key="post.id" :post="post" /></div>
      </section>
      <section v-if="results.users.length" class="content-section">
        <h2>用户</h2><div class="search-users"><div v-for="user in results.users" :key="user.id"><AppAvatar :src="user.avatar_url" :name="user.nickname || '用户'" /><strong>{{ user.nickname || '用户' }}</strong></div></div>
      </section>
      <p v-if="!results.content.length && !results.posts.length && !results.users.length" class="state-message">没有找到相关内容</p>
    </template>
    <p v-else class="state-message">输入至少两个字符开始搜索。</p>
  </div>
</template>
