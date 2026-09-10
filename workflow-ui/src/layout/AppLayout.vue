<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const { users, currentUser } = storeToRefs(userStore)
const route = useRoute()

onMounted(() => {
  userStore.loadUsers().catch(() => ElMessage.error('用户列表加载失败'))
})

function onUserChange(id: number) {
  const next = users.value.find((u) => u.id === id)
  if (next) userStore.currentUser = next
}
</script>

<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="brand">审批流</div>
      <el-menu mode="horizontal" :default-active="route.path" router class="nav">
        <el-menu-item index="/apply">发起申请</el-menu-item>
        <el-menu-item index="/todo">待办审批</el-menu-item>
        <el-menu-item index="/my">我的申请</el-menu-item>
        <el-menu-item index="/designer">流程设计器</el-menu-item>
      </el-menu>
      <div class="user-area">
        <span class="label">当前用户</span>
        <el-select
          :model-value="currentUser?.id"
          placeholder="选择用户"
          style="width: 160px"
          @change="onUserChange"
        >
          <el-option
            v-for="u in users"
            :key="u.id"
            :label="`${u.name}（${u.id}）`"
            :value="u.id"
          />
        </el-select>
      </div>
    </el-header>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}
.header {
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.brand {
  font-weight: 700;
  font-size: 18px;
  white-space: nowrap;
}
.nav {
  flex: 1;
  border-bottom: none;
}
.user-area {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.main {
  background: var(--el-fill-color-extra-light);
}
</style>
