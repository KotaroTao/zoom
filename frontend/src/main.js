import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Clients from './views/Clients.vue'
import ClientDetail from './views/ClientDetail.vue'
import Meetings from './views/Meetings.vue'
import MeetingDetail from './views/MeetingDetail.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/clients', component: Clients },
  { path: '/clients/:id', component: ClientDetail },
  { path: '/meetings', component: Meetings },
  { path: '/meetings/:id', component: MeetingDetail },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.mount('#app')
