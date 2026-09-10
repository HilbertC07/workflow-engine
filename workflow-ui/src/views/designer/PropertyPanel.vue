<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { listRoles, listUsers } from '@/api/workflow'
import type { AssigneeType, MultiMode, NodeProps, ProcessRole, ProcessUser, RejectStrategy } from '@/types/workflow'

export interface SelectedNode {
  id: string
  type: string
  name: string
  props: NodeProps
}

const props = defineProps<{ node: SelectedNode | null }>()

const emit = defineEmits<{
  (e: 'update', patch: Partial<NodeProps>): void
  (e: 'rename', name: string): void
}>()

const users = ref<ProcessUser[]>([])
const roles = ref<ProcessRole[]>([])

onMounted(async () => {
  try {
    ;[users.value, roles.value] = await Promise.all([listUsers(), listRoles()])
  } catch {
    /* 拦截器已提示 */
  }
})

const isApproval = computed(() => props.node?.type === 'approval-node')
const isCc = computed(() => props.node?.type === 'cc-node')

/** 审批人类型：界面只列四种，INITIATOR_SELF 不展示 */
const assigneeTypeOptions: Array<{ label: string; value: AssigneeType }> = [
  { label: '指定用户', value: 'USER' },
  { label: '指定角色', value: 'ROLE' },
  { label: '部门主管', value: 'DEPT_LEADER' },
  { label: '发起人自选', value: 'INITIATOR_CHOOSE' },
]

const multiModeOptions: Array<{ label: string; value: MultiMode }> = [
  { label: '会签', value: 'ALL' },
  { label: '或签', value: 'ANY' },
]

const rejectStrategyOptions: Array<{ label: string; value: RejectStrategy }> = [
  { label: '驳回到发起人', value: 'TO_INITIATOR' },
  { label: '驳回到上一节点', value: 'TO_PREVIOUS_NODE' },
  { label: '直接终止', value: 'TERMINATE' },
]

const p = computed(() => props.node?.props ?? {})

function patch(propsPatch: Partial<NodeProps>) {
  emit('update', propsPatch)
}

/** allowReject 关闭时 rejectStrategy 联动禁用并清空 */
watch(
  () => p.value.allowReject,
  (v) => {
    if (!v && p.value.rejectStrategy) {
      patch({ rejectStrategy: undefined })
    }
  },
)

function onUserIdsChange(val: number[]) {
  if (!props.node) return
  if (isApproval.value && p.value.assigneeType === 'USER') {
    patch({ assigneeConfig: { ...p.value.assigneeConfig, userIds: val } })
  } else if (isCc.value) {
    patch({ userIds: val })
  }
}

function onRoleCodesChange(val: string[]) {
  patch({ assigneeConfig: { ...p.value.assigneeConfig, roleCodes: val } })
}

const currentUserIdOptions = computed(() =>
  p.value.assigneeType === 'USER' ? (p.value.assigneeConfig?.userIds ?? []) : [],
)
const currentCcUserIds = computed(() => (isCc.value ? (p.value.userIds ?? []) : []))

const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? String(id)
</script>

<template>
  <div class="property-panel">
    <div class="panel-title">属性</div>

    <template v-if="node">
      <el-form label-position="top" size="default">
        <el-form-item label="节点名称">
          <el-input :model-value="node.name" @update:model-value="emit('rename', $event)" />
        </el-form-item>

        <template v-if="isApproval">
          <el-form-item label="审批人类型">
            <el-select
              :model-value="p.assigneeType"
              placeholder="请选择"
              clearable
              @update:model-value="patch({ assigneeType: $event || undefined })"
            >
              <el-option v-for="o in assigneeTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="p.assigneeType === 'USER'" label="指定用户">
            <el-select
              :model-value="currentUserIdOptions"
              multiple
              placeholder="请选择用户"
              @update:model-value="onUserIdsChange"
            >
              <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="p.assigneeType === 'ROLE'" label="指定角色">
            <el-select
              :model-value="p.assigneeConfig?.roleCodes ?? []"
              multiple
              placeholder="请选择角色"
              @update:model-value="onRoleCodesChange"
            >
              <el-option v-for="r in roles" :key="r.code" :label="r.name" :value="r.code" />
            </el-select>
          </el-form-item>

          <el-form-item label="审批模式">
            <el-radio-group :model-value="p.multiMode" @update:model-value="patch({ multiMode: $event || undefined })">
              <el-radio v-for="o in multiModeOptions" :key="o.value" :value="o.value">{{ o.label }}</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="允许驳回">
            <el-switch :model-value="p.allowReject ?? false" @update:model-value="patch({ allowReject: $event })" />
          </el-form-item>

          <el-form-item label="驳回策略">
            <el-select
              :model-value="p.rejectStrategy"
              placeholder="请选择"
              clearable
              :disabled="!(p.allowReject ?? false)"
              @update:model-value="patch({ rejectStrategy: $event || undefined })"
            >
              <el-option v-for="o in rejectStrategyOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>

          <el-form-item label="允许转办">
            <el-switch :model-value="p.allowTransfer ?? false" @update:model-value="patch({ allowTransfer: $event })" />
          </el-form-item>
        </template>

        <template v-if="isCc">
          <el-form-item label="抄送人">
            <el-select
              :model-value="currentCcUserIds"
              multiple
              placeholder="请选择抄送人"
              @update:model-value="onUserIdsChange"
            >
              <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </template>

        <el-empty v-if="!isApproval && !isCc" description="该节点无配置项" :image-size="60" />
      </el-form>
    </template>

    <el-empty v-else description="点击画布节点编辑属性" />
  </div>
</template>

<style scoped>
.property-panel {
  width: 280px;
  border-left: 1px solid var(--el-border-color-light);
  padding: 12px;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--el-bg-color);
}

.panel-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}
</style>
