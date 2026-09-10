<script setup lang="ts">
/**
 * 流转时间线（待办页 / 我的申请页共用）：
 * - action 翻译成中文
 * - operatorId 经 /users 数据映射成姓名，不直接展示数字 id
 */
import { ref, watch } from 'vue'
import { listRecords, listUsers } from '@/api/workflow'
import type { RecordAction, TaskRecordVO } from '@/types/workflow'

const props = defineProps<{ instanceId: number }>()

const ACTION_TEXT: Record<RecordAction, string> = {
  SUBMIT: '提交申请',
  APPROVE: '同意',
  REJECT: '驳回',
  CC: '抄送',
  CANCEL: '撤回',
  FINISH: '流程结束',
}

const records = ref<TaskRecordVO[]>([])
const userNameMap = ref<Record<number, string>>({})
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [list, users] = await Promise.all([listRecords(props.instanceId), listUsers()])
    records.value = list
    const map: Record<number, string> = {}
    users.forEach((u) => (map[u.id] = u.name))
    userNameMap.value = map
  } finally {
    loading.value = false
  }
}

watch(() => props.instanceId, load, { immediate: true })
</script>

<template>
  <div v-loading="loading">
    <el-timeline v-if="records.length">
      <el-timeline-item
        v-for="r in records"
        :key="r.id"
        :timestamp="`${r.createTime} · 第 ${r.round} 轮`"
        placement="top"
      >
        <b>{{ userNameMap[r.operatorId] ?? `用户${r.operatorId}` }}</b>
        【{{ ACTION_TEXT[r.action] ?? r.action }}】
        <span v-if="r.nodeName">· {{ r.nodeName }}</span>
        <div v-if="r.comment" class="comment">意见：{{ r.comment }}</div>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else description="暂无流转记录" :image-size="60" />
  </div>
</template>

<style scoped>
.comment {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 4px;
}
</style>
