import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layout/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/apply' },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: 'apply', component: () => import('@/views/apply/ApplyView.vue') },
        { path: 'todo', component: () => import('@/views/todo/TodoView.vue') },
        { path: 'my', component: () => import('@/views/my/MyInstancesView.vue') },
      ],
    },
    // 设计器是全屏画布，不套公共布局，原样挂载 M2 产物
    { path: '/designer', component: () => import('@/views/designer/DesignerView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFound.vue') },
  ],
})

export default router
