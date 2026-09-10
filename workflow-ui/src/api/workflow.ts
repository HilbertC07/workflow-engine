import http from './http'
import type {
  DefinitionVO,
  InstanceVO,
  ProcessRole,
  ProcessUser,
  TaskRecordVO,
  TaskVO,
} from '@/types/workflow'

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

/** GET /api/workflow/definition/list —— 所有启用中的流程定义（每 code 最新版本） */
export function listEnabledDefinitions(): Promise<DefinitionVO[]> {
  return http.get('/api/workflow/definition/list')
}

export interface InstanceStartPayload {
  defCode: string
  initiatorId: number
  title: string
  businessKey?: string
  /** INITIATOR_CHOOSE 节点的自选审批人，key=nodeKey */
  chosenUserIds?: Record<string, number[]>
}

/** POST /api/workflow/instance/start */
export function startInstance(payload: InstanceStartPayload): Promise<InstanceVO> {
  return http.post('/api/workflow/instance/start', payload)
}

/** GET /api/workflow/instance/my */
export function listMyInstances(initiatorId: number, status?: string): Promise<InstanceVO[]> {
  return http.get('/api/workflow/instance/my', { params: { initiatorId, status } })
}

/** POST /api/workflow/instance/{id}/cancel */
export function cancelInstance(id: number, operatorId: number): Promise<InstanceVO> {
  return http.post(`/api/workflow/instance/${id}/cancel`, { operatorId })
}

/** GET /api/workflow/instance/{id}/records */
export function listRecords(instanceId: number): Promise<TaskRecordVO[]> {
  return http.get(`/api/workflow/instance/${instanceId}/records`)
}

/** GET /api/workflow/task/todo */
export function listTodoTasks(assigneeId: number): Promise<TaskVO[]> {
  return http.get('/api/workflow/task/todo', { params: { assigneeId } })
}

/** GET /api/workflow/task/done */
export function listDoneTasks(assigneeId: number): Promise<TaskVO[]> {
  return http.get('/api/workflow/task/done', { params: { assigneeId } })
}

export interface OperatorPayload {
  operatorId: number
  comment?: string
}

/** POST /api/workflow/task/{id}/approve */
export function approveTask(id: number, payload: OperatorPayload): Promise<InstanceVO> {
  return http.post(`/api/workflow/task/${id}/approve`, payload)
}

/** POST /api/workflow/task/{id}/reject */
export function rejectTask(id: number, payload: OperatorPayload): Promise<InstanceVO> {
  return http.post(`/api/workflow/task/${id}/reject`, payload)
}
