<script setup lang="ts">
/**
 * 我的申请页：我发起的实例列表 → 状态 tag 着色 → 详情时间线 / 撤回（canWithdraw 控制 + 二次确认）
 */
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { cancelInstance, listMyInstances } from '@/api/workflow'
import type { InstanceVO } from '@/types/workflow'
import ApprovalTimeline from '@/components/ApprovalTimeline.vue'

const userStore = useUserStore()
const { currentUser } = storeToRefs(userStore)

const list = ref<InstanceVO[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const detailInstance = ref<InstanceVO | null>(null)
const cancelling = ref(-1)

const STATUS_TAG: Record<string, 'primary' | 'success' | 'danger' | 'info'> = {
  RUNNING: 'primary',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'info',
}
const STATUS_TEXT: Record<string, string> = {
  RUNNING: '进行中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已撤回',
}

function load() {
  if (!currentUser.value) return
  loading.value = true
  listMyInstances(currentUser.value.id)
    .then((data) => (list.value = data))
    .finally(() => (loading.value = false))
}

onMounted(load)
watch(currentUser, load)

function showDetail(row: InstanceVO) {
  detailInstance.value = row
  detailVisible.value = true
}

function onWithdraw(row: InstanceVO) {
  ElMessageBox.confirm(`确认撤回「${row.title}」吗？撤回后流程终止。`, '撤回确认', { type: 'warning' })
    .then(() => {
      if (!currentUser.value) return
      cancelling.value = row.instanceId
      cancelInstance(row.instanceId, currentUser.value.id)
        .then(() => {
          ElMessage.success('已撤回')
          load()
        })
        .finally(() => (cancelling.value = -1))
    })
    .catch(() => {})
}
</script>

<template>
  <el-card>
    <template #header>我的申请 —— 当前用户：{{ currentUser?.name ?? '未选择' }}</template>
    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="currentNodeKey" label="当前节点" width="160" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="STATUS_TAG[row.status] ?? 'info'">{{ STATUS_TEXT[row.status] ?? row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="startTime" label="发起时间" width="180" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" @click="showDetail(row)">详情</el-button>
          <el-button
            size="small"
            type="warning"
            :disabled="!row.canWithdraw"
            :loading="cancelling === row.instanceId"
            @click="onWithdraw(row)"
          >
            撤回
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailVisible" :title="`详情：${detailInstance?.title ?? ''}`" width="560px">
      <el-descriptions border size="small" v-if="detailInstance">
        <el-descriptions-item label="状态">{{ STATUS_TEXT[detailInstance.status] }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detailInstance.currentNodeKey }}</el-descriptions-item>
        <el-descriptions-item label="发起时间">{{ detailInstance.startTime }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ detailInstance.endTime ?? '—' }}</el-descriptions-item>
      </el-descriptions>
      <div style="margin-top: 16px">
        <ApprovalTimeline v-if="detailInstance" :instance-id="detailInstance.instanceId" />
      </div>
    </el-dialog>
  </el-card>
</template>
