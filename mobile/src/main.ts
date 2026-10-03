import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { hideSplash, initNative } from './services/native';
import './style.css';
import './style-phase2.css';
import './style-ios.css';
import './style-phase4.css';
import './style-home.css';
import './style-phase42.css';
import './style-phase43.css';
import './style-phase45.css';
import './style-phase451.css';
import './style-phase47.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
const auth = useAuthStore(pinia);

app.mount('#app');
void hideSplash().catch(() => undefined);
void auth.initialize().catch(() => undefined);
void initNative(router, auth).catch(() => undefined);
