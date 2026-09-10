<script setup lang="ts">
/** 左侧节点面板：mousedown 触发 lf.dnd.startDrag（由父组件监听执行，带拖拽预览） */
const emit = defineEmits<{
  (e: 'drag-start', type: string): void
}>()

const items = [
  { type: 'start-node', label: '开始', color: '#909399' },
  { type: 'approval-node', label: '审批', color: '#409eff' },
  { type: 'cc-node', label: '抄送', color: '#e6a23c' },
  { type: 'end-node', label: '结束', color: '#67c23a' },
]
</script>

<template>
  <div class="node-panel">
    <div class="panel-title">节点</div>
    <div
      v-for="item in items"
      :key="item.type"
      class="panel-item"
      :style="{ borderColor: item.color, color: item.color }"
      title="拖拽到画布"
      @mousedown="emit('drag-start', item.type)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
.node-panel {
  width: 180px;
  border-right: 1px solid var(--el-border-color-light);
  padding: 12px;
  box-sizing: border-box;
  flex-shrink: 0;
  background: var(--el-bg-color);
}

.panel-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.panel-item {
  border: 1px dashed;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
  text-align: center;
  cursor: grab;
  user-select: none;
  font-size: 14px;
  background: var(--el-bg-color);
  transition: box-shadow 0.2s;
}

.panel-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
