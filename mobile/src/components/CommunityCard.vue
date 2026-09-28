<script setup lang="ts">
import type { CommunityPost } from '../types/community';
import AppAvatar from './AppAvatar.vue';
defineProps<{ post: CommunityPost; pending?: boolean }>();
defineEmits<{ like: [post: CommunityPost]; share: [post: CommunityPost] }>();
function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
</script>
<template>
  <article class="post-card">
    <RouterLink :to="`/community/${post.id}`" class="post-card__main">
      <header>
        <AppAvatar :src="post.avatar_url" :user-id="post.user_id" :name="post.nickname || '社区用户'" />
        <div>
          <strong>{{ post.nickname || '社区用户' }}</strong
          ><time :datetime="post.created_at">{{ formatTime(post.created_at) }}</time>
        </div>
        <span v-if="post.category" class="post-category">{{ post.category }}</span>
      </header>
      <h2 v-if="post.title">{{ post.title }}</h2>
      <p>{{ post.content }}</p>
      <img v-if="post.image_url" class="post-card__image" :src="post.image_url" alt="帖子图片" loading="lazy" />
    </RouterLink>
    <footer>
      <button
        type="button"
        :disabled="pending"
        :aria-label="`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.likeCount} 个赞`"
        :aria-pressed="post.liked"
        @click="$emit('like', post)"
      >
        {{ post.liked ? '♥' : '♡' }} {{ post.likeCount }}</button
      ><RouterLink :to="`/community/${post.id}`" :aria-label="`查看 ${post.replyCount} 条评论`"
        >评论 {{ post.replyCount }}</RouterLink
      ><button type="button" aria-label="分享这条动态" @click="$emit('share', post)">分享</button>
    </footer>
  </article>
</template>
