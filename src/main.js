import { createApp } from 'vue'
import App from './App.vue'
import { pinia } from './stores'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import './styles/app.scss'

const app = createApp(App)

app.use(pinia)
app.use(ArcoVue)

app.mount('#app')
