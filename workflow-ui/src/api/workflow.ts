import http from './http'
import type { DefinitionVO, ProcessRole, ProcessUser } from '@/types/workflow'

export interface DefinitionSavePayload {
  code: string
  name: string
  description?: string
  /** 完整流程图 JSON —— 注意是字符串，不是对象 */
  graphJson: string
}

/** POST /api/workflow/definition/save */
export function saveDefinition(payload: DefinitionSavePayload): Promise<void> {
  return http.post('/api/workflow/definition/save', payload)
}

/** GET /api/workflow/definition/{code}/latest-enabled */
export function getLatestEnabled(code: string): Promise<DefinitionVO> {
  return http.get(`/api/workflow/definition/${encodeURIComponent(code)}/latest-enabled`)
}

/** GET /api/workflow/users */
export function listUsers(): Promise<ProcessUser[]> {
  return http.get('/api/workflow/users')
}

/** GET /api/workflow/roles */
export function listRoles(): Promise<ProcessRole[]> {
  return http.get('/api/workflow/roles')
}
