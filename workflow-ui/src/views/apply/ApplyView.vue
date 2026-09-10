<script setup lang="ts">
/**
 * 发起申请页：选流程定义 → 填标题/业务键 → 提交 → 展示发起结果
 * 含 INITIATOR_CHOOSE 节点的流程第一版不支持在线发起，给出明确提示（不静默失败）
 */
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { listEnabledDefinitions, startInstance } from '@/api/workflow'
import type { DefinitionVO, FlowGraph, InstanceVO, NodeProps } from '@/types/workflow'

const userStore = useUserStore()
const { currentUser } = storeToRefs(userStore)

const definitions = ref<DefinitionVO[]>([])
const defCode = ref('')
const title = ref('')
const businessKey = ref('')
const submitting = ref(false)
const result = ref<InstanceVO | null>(null)

/** 当前选中定义里是否含发起人自选审批人节点 */
const hasInitiatorChoose = ref(false)

function loadDefinitions() {
  listEnabledDefinitions()
    .then((list) => (definitions.value = list))
    .catch(() => ElMessage.error('流程定义加载失败'))
}

onMounted(loadDefinitions)

watch(defCode, (code) => {
  hasInitiatorChoose.value = false
  const def = definitions.value.find((d) => d.code === code)
  if (!def?.graphJson) return
  try {
    const graph = JSON.parse(def.graphJson) as FlowGraph
    hasInitiatorChoose.value = (graph.nodes ?? []).some(
      (n) => (n.props as NodeProps | undefined)?.assigneeType === 'INITIATOR_CHOOSE',
    )
  } catch {
    hasInitiatorChoose.value = false
  }
})

function onSubmit() {
  if (!currentUser.value) return ElMessage.warning('请先选择当前用户')
  if (!defCode.value) return ElMessage.warning('请选择流程')
  if (!title.value.trim()) return ElMessage.warning('标题不能为空')
  if (hasInitiatorChoose.value) {
    return ElMessage.warning('该流程含「发起人自选审批人」节点，第一版暂不支持在线发起，请调整流程配置')
  }
  submitting.value = true
  startInstance({
    defCode: defCode.value,
    initiatorId: currentUser.value.id,
    title: title.value.trim(),
    businessKey: businessKey.value.trim() || undefined,
  })
    .then((inst) => {
      result.value = inst
      ElMessage.success('发起成功')
      title.value = ''
      businessKey.value = ''
    })
    .finally(() => (submitting.value = false))
}

function statusText(status?: string) {
  return { RUNNING: '进行中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已撤回' }[
    status ?? ''
  ] ?? status
}
</script>

<template>
  <el-card>
    <template #header>发起申请</template>
    <el-form label-width="100px" style="max-width: 560px">
      <el-form-item label="流程" required>
        <el-select v-model="defCode" placeholder="选择流程定义" style="width: 100%">
          <el-option
            v-for="d in definitions"
            :key="d.code"
            :label="`${d.name}（v${d.version}）`"
            :value="d.code"
          />
        </el-select>
      </el-form-item>
      <el-alert
        v-if="hasInitiatorChoose"
        type="warning"
        :closable="false"
        show-icon
        title="该流程含「发起人自选审批人」节点，第一版暂不支持在线发起"
      />
      <el-form-item label="标题" required>
        <el-input v-model="title" placeholder="申请标题（必填）" maxlength="100" />
      </el-form-item>
      <el-form-item label="业务键">
        <el-input v-model="businessKey" placeholder="业务键（选填，如报销单号）" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitting" :disabled="hasInitiatorChoose" @click="onSubmit">
          提交申请
        </el-button>
      </el-form-item>
    </el-form>

    <el-descriptions v-if="result" title="发起结果" border style="max-width: 560px; margin-top: 16px">
      <el-descriptions-item label="实例 ID">{{ result.instanceId }}</el-descriptions-item>
      <el-descriptions-item label="标题">{{ result.title }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ statusText(result.status) }}</el-descriptions-item>
      <el-descriptions-item label="当前节点">{{ result.currentNodeKey }}</el-descriptions-item>
      <el-descriptions-item label="发起时间">{{ result.startTime }}</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>
