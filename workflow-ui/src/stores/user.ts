import { defineStore } from 'pinia'
import { listUsers } from '@/api/workflow'
import type { ProcessUser } from '@/types/workflow'

/** 只存“当前用户”，第一版不做权限 */
export const useUserStore = defineStore('user', {
  state: () => ({
    users: [] as ProcessUser[],
    currentUser: null as ProcessUser | null,
  }),
  actions: {
    async loadUsers() {
      this.users = await listUsers()
      if (!this.currentUser && this.users.length > 0) {
        this.currentUser = this.users[0]
      }
    },
  },
})
