import { createRouter, createWebHashHistory } from 'vue-router'

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
   },
   {
     path: '/summary/:id',
     name: 'Summary',
     component: () => import('../views/Summary.vue')
   }
 ]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
