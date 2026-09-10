<script setup lang="ts">
/**
 * 待办审批页：Tab 待办/已办；同意/驳回（可填意见，驳回必填）；点标题展开流转时间线
 */
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { approveTask, listDoneTasks, listTodoTasks, rejectTask } from '@/api/workflow'
import type { InstanceVO, TaskVO } from '@/types/workflow'
import ApprovalTimeline from '@/components/ApprovalTimeline.vue'

const userStore = useUserStore()
const { currentUser } = storeToRefs(userStore)

const activeTab = ref<'todo' | 'done'>('todo')
const todoList = ref<TaskVO[]>([])
const doneList = ref<TaskVO[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const dialogAction = ref<'approve' | 'reject'>('approve')
const currentTask = ref<TaskVO | null>(null)
const comment = ref('')
const acting = ref(false)

/** 展开时间线的实例 id；-1 表示无 */
const expandedInstanceId = ref(-1)

function load() {
  if (!currentUser.value) return
  loading.value = true
  const id = currentUser.value.id
  const jobs = activeTab.value === 'todo' ? listTodoTasks(id) : listDoneTasks(id)
  jobs
    .then((list) => {
      if (activeTab.value === 'todo') todoList.value = list
      else doneList.value = list
    })
    .finally(() => (loading.value = false))
}

onMounted(load)
watch([currentUser, activeTab], load)

function openDialog(task: TaskVO, action: 'approve' | 'reject') {
  currentTask.value = task
  dialogAction.value = action
  comment.value = ''
  dialogVisible.value = true
}

function onConfirm() {
  const task = currentTask.value
  if (!task || !currentUser.value) return
  if (dialogAction.value === 'reject' && !comment.value.trim()) {
    return ElMessage.warning('驳回意见必填，发起人需要知道被打回的原因')
  }
  acting.value = true
  const payload = { operatorId: currentUser.value.id, comment: comment.value.trim() || undefined }
  const call = dialogAction.value === 'approve' ? approveTask(task.taskId, payload) : rejectTask(task.taskId, payload)
  call
    .then((inst: InstanceVO) => {
      if (inst.status === 'RUNNING') ElMessage.success(`已${dialogAction.value === 'approve' ? '同意' : '驳回'}，流程推进到下一节点`)
      else ElMessage.success(`已${dialogAction.value === 'approve' ? '同意' : '驳回'}，流程已结束（${inst.status}）`)
      dialogVisible.value = false
      load()
    })
    .finally(() => (acting.value = false))
}

function toggleTimeline(task: TaskVO) {
  expandedInstanceId.value = expandedInstanceId.value === task.instanceId ? -1 : task.instanceId
}

function statusTag(status: string) {
  const map: Record<string, string> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info', TRANSFERRED: 'info', COMPLETED: 'info' }
  return map[status] ?? 'info'
}
</script>

<template>
  <el-card>
    <template #header>待办审批 —— 当前用户：{{ currentUser?.name ?? '未选择' }}</template>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="待办" name="todo">
        <el-table :data="todoList" v-loading="loading" border>
          <el-table-column label="标题">
            <template #default="{ row }">
              <el-link type="primary" @click="toggleTimeline(row)">{{ row.instanceTitle }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="nodeName" label="当前节点" />
          <el-table-column prop="createTime" label="提交时间" width="180" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="openDialog(row, 'approve')">同意</el-button>
              <el-button size="small" type="danger" @click="openDialog(row, 'reject')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="已办" name="done">
        <el-table :data="doneList" v-loading="loading" border>
          <el-table-column prop="instanceTitle" label="标题" />
          <el-table-column prop="nodeName" label="节点" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-card v-if="expandedInstanceId !== -1" shadow="never" style="margin-top: 16px">
      <template #header>流转时间线（实例 #{{ expandedInstanceId }}）</template>
      <ApprovalTimeline :instance-id="expandedInstanceId" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogAction === 'approve' ? '同意审批' : '驳回审批'" width="480px">
      <p>任务：{{ currentTask?.instanceTitle }} · {{ currentTask?.nodeName }}</p>
      <el-input
        v-model="comment"
        type="textarea"
        :rows="3"
        :placeholder="dialogAction === 'approve' ? '审批意见（选填）' : '驳回意见（必填）'"
      />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="onConfirm">确认</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
