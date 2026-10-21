import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@/app/styles/main.css'
import { applyStoredTheme } from '@/shared/lib/theme/theme.service'
import { clickOutside } from './app/directives/clickOutside'
import { i18n } from '@/shared/lib/i18n/i18n'

applyStoredTheme()

async function bootstrap() {
if (new URLSearchParams(location.search).has('postit')) {
  const { default: PostitWindow } = await import('@/features/postits/components/PostitWindow.vue')
  createApp(PostitWindow).use(i18n).mount('#app')
  return
}
const [{ default: App }, { router }] = await Promise.all([import('@/app/App.vue'), import('@/app/router')])
const app = createApp(App)

app.directive('click-outside', clickOutside)
app.use(createPinia())
app.use(i18n)
app.use(router)
app.mount('#app')

}
void bootstrap()
