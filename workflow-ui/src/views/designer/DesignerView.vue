<script setup lang="ts">
import LogicFlow from '@logicflow/core'
import { Control, MiniMap, Snapshot } from '@logicflow/extension'
import '@logicflow/core/es/index.css'
import '@logicflow/extension/es/index.css'
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getLatestEnabled, saveDefinition } from '@/api/workflow'
import { registerWfNodes } from '@/logicflow/register'
import { toBackendGraph, toLfData, validateBackendGraph } from '@/logicflow/mapper'
import { useUserStore } from '@/stores/user'
import NodePanel from './NodePanel.vue'
import PropertyPanel, { type SelectedNode } from './PropertyPanel.vue'
import './styles.css'

const lfRef = ref<HTMLDivElement | null>(null)
let lf: LogicFlow | null = null

const userStore = useUserStore()

const flowCode = ref('')
const flowName = ref('')
const selectedNode = ref<SelectedNode | null>(null)
const saving = ref(false)
const loading = ref(false)

const toolbar = reactive({ zoomRatio: 100 })

onMounted(async () => {
  if (!lfRef.value) return
  lf = new LogicFlow({
    container: lfRef.value,
    grid: { size: 20, visible: true, type: 'dot', config: { color: '#e0e0e0' } },
    edgeType: 'polyline',
    keyboard: { enabled: true },
    // LogicFlow 2.x 的 use 是静态方法，插件必须通过 plugins 选项传入，
    // 否则 lf.use(...) 抛 TypeError，onMounted 中断 → render() 不执行 → 画布空白、拖不进节点
    plugins: [Control, MiniMap, Snapshot],
  })
  registerWfNodes(lf)
  lf.render({ nodes: [], edges: [] })

  lf.on('node:click', ({ data }: any) => {
    const model = lf!.getNodeModelById(data.id)!
    selectedNode.value = {
      id: data.id,
      type: data.type,
      name: (model.text as unknown as { value?: string })?.value ?? String(model.text ?? ''),
      props: (data.properties?.props ?? {}) as SelectedNode['props'],
    }
  })
  // 连线被规则拒绝时（如从左锚点连出）必须提示，否则用户只会觉得「连不上」而无任何反馈
  lf.on('connection:not-allowed', ({ msg }: any) => {
    ElMessage.error(msg || '不允许的连线')
  })
  lf.on('blank:click', () => {
    selectedNode.value = null
  })
  // 节点被删除后属性面板必须清空，否则右侧仍显示已不存在节点的配置
  lf.on('node:delete', ({ data }: any) => {
    if (selectedNode.value?.id === data.id) selectedNode.value = null
  })
  lf.on('history:change', syncZoomRatio)
  syncZoomRatio()

  // 开发调试钩子：便于在浏览器控制台/CDP 里直接检查图数据与调用 lf API 排障
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__wfLf = lf
  }

  try {
    await userStore.loadUsers()
  } catch {
    /* 拦截器已提示 */
  }
})

onBeforeUnmount(() => {
  lf?.destroy?.()
  lf = null
})

/** 左侧面板拖拽：统一走 lf.dnd.startDrag（带预览，落点跟随鼠标） */
function onDragStart(type: string) {
  lf?.dnd.startDrag({
    type,
    text: type === 'start-node' ? '开始' : type === 'approval-node' ? '审批' : type === 'cc-node' ? '抄送' : '结束',
    properties: { props: {} },
  })
}

/** 属性变更：实时同步画布节点文案（含会签/或签小标签，由 view 读 properties 重绘） */
function onPropsUpdate(patch: Partial<SelectedNode['props']>) {
  if (!lf || !selectedNode.value) return
  const model = lf.getNodeModelById(selectedNode.value.id)
  if (!model) return
  const nextProps = { ...selectedNode.value.props, ...patch }
  model.setProperties({ ...model.properties, props: nextProps })
  selectedNode.value = { ...selectedNode.value, props: nextProps }
}

function onRename(name: string) {
  if (!lf || !selectedNode.value) return
  const model = lf.getNodeModelById(selectedNode.value.id)
  if (!model) return
  lf.updateText(selectedNode.value.id, name)
  model.setProperties({ ...model.properties, name })
  selectedNode.value = { ...selectedNode.value, name }
}

function clearSelection() {
  selectedNode.value = null
}

/**
 * 缩放百分比。LogicFlow 2.x 没有 getZoom()，只有 getTransform().SCALE_X（1 = 100%）。
 */
function syncZoomRatio() {
  if (!lf) return
  const { SCALE_X } = lf.getTransform()
  toolbar.zoomRatio = Math.round(SCALE_X * 100)
}

/** ratio > 0 放大，否则缩小。LogicFlow 2.x 的 zoom 接受 true/false（内置刻度）或比例值 */
function zoom(ratio: number) {
  lf?.zoom(ratio > 0)
  syncZoomRatio()
}

function fitView() {
  lf?.fitView()
  syncZoomRatio()
}

function exportImage() {
  lf?.getSnapshot?.()
}

/** 保存：前端四项校验 -> graphJson 为字符串 -> code!==0 由拦截器展示后端 msg */
async function onSave() {
  if (!lf) return
  if (!flowCode.value.trim()) {
    ElMessage.error('请填写流程编码')
    return
  }
  if (!flowName.value.trim()) {
    ElMessage.error('请填写流程名称')
    return
  }
  const graph = toBackendGraph(lf.getGraphData() as never)
  const errors = validateBackendGraph(graph)
  if (errors.length > 0) {
    ElMessage.error(errors[0])
    return
  }
  saving.value = true
  try {
    await saveDefinition({
      code: flowCode.value.trim(),
      name: flowName.value.trim(),
      graphJson: JSON.stringify(graph),
    })
    ElMessage.success('保存成功')
  } catch {
    /* 拦截器已提示后端 msg */
  } finally {
    saving.value = false
  }
}

/** 加载：取最新启用版本 -> JSON.parse(graphJson) -> lf.render 还原坐标 */
async function onLoad() {
  if (!lf) return
  if (!flowCode.value.trim()) {
    ElMessage.error('请填写流程编码')
    return
  }
  loading.value = true
  try {
    const def = await getLatestEnabled(flowCode.value.trim())
    if (def.name) flowName.value = def.name
    const graph = JSON.parse(def.graphJson as string)
    lf.render(toLfData(graph))
    clearSelection()
    ElMessage.success(`已加载流程「${def.name || def.code}」`)
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="designer-page">
    <div class="designer-toolbar">
      <el-input v-model="flowCode" placeholder="流程编码" class="toolbar-input" />
      <el-input v-model="flowName" placeholder="流程名称" class="toolbar-input" />
      <el-divider direction="vertical" />
      <span class="toolbar-label">当前用户</span>
      <el-select
        :model-value="userStore.currentUser?.id"
        class="toolbar-user"
        placeholder="选择用户"
        @update:model-value="userStore.currentUser = userStore.users.find((u) => u.id === $event) ?? null"
      >
        <el-option v-for="u in userStore.users" :key="u.id" :label="u.name" :value="u.id" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button @click="zoom(-0.1)">缩小</el-button>
      <span class="zoom-text">{{ toolbar.zoomRatio }}%</span>
      <el-button @click="zoom(0.1)">放大</el-button>
      <el-button @click="fitView">适应画布</el-button>
      <el-button @click="exportImage">导出图片</el-button>
      <el-divider direction="vertical" />
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      <el-button :loading="loading" @click="onLoad">加载</el-button>
    </div>

    <div class="designer-body">
      <NodePanel @drag-start="onDragStart" />
      <div ref="lfRef" class="designer-canvas" @dragover.prevent @drop.prevent="clearSelection" />
      <PropertyPanel :node="selectedNode" @update="onPropsUpdate" @rename="onRename" />
    </div>
  </div>
</template>

<style scoped>
.designer-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.designer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  flex-shrink: 0;
}

.toolbar-input {
  width: 160px;
}

.toolbar-user {
  width: 140px;
}

.toolbar-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.zoom-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 40px;
  text-align: center;
}

.designer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.designer-canvas {
  flex: 1;
  min-width: 0;
}
</style>
