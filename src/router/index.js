import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ChatList',
    component: () => import('../views/ChatList.vue')
  },
  {
    path: '/chat/:id',
    name: 'Chat',
    component: () => import('../views/Chat.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  },
  {
    path: '/character/:id?',
    name: 'Character',
    component: () => import('../views/Character.vue')
  },
   {
     path: '/worldbook/:id?',
     name: 'WorldBook',
     component: () => import('../views/WorldBook.vue')
   }
 ]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
