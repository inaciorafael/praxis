import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/app/App.vue'
import { router } from '@/app/router'
import '@/app/styles/main.css'
import { applyStoredTheme } from '@/shared/lib/theme/theme.service'
import { clickOutside } from './app/directives/clickOutside'

applyStoredTheme()

const app = createApp(App)

app.directive('click-outside', clickOutside)
app.use(createPinia())
app.use(router)
app.mount('#app')
