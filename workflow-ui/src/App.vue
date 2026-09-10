<script setup lang="ts">
import DesignerView from '@/views/designer/DesignerView.vue'

/**
 * 不引入 vue-router：/ 与 /designer 都渲染设计器，其他路径提示。
 * DesignerView 保持纯组件，不读 location，M3 加 vue-router 时只包一层路由。
 */
const path = window.location.pathname
const showDesigner = path === '/' || path === '/designer'
</script>

<template>
  <DesignerView v-if="showDesigner" />
  <div v-else class="route-tip">
    <h2>页面不存在</h2>
    <p>请访问 <a href="/designer">/designer</a> 打开流程设计器。</p>
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
}

.route-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
}
</style>
