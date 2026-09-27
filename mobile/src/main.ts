import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { hideSplash, initNative } from './services/native';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
const auth = useAuthStore(pinia);

void router.isReady().then(async () => {
  app.mount('#app');
  try { await initNative(router, auth); }
  catch { /* The web UI remains usable if a native plugin is unavailable. */ }
  finally { await hideSplash().catch(() => undefined); }
});
void auth.restoreSession();
