/**
 * 与后端 DTO 对齐的类型定义（字段名全部驼峰，与后端 Java 字段一一对应）。
 * 后端源码参考：
 *  - domain/enums/NodeType        START | APPROVAL | CC | END
 *  - domain/enums/AssigneeType    USER | ROLE | DEPT_LEADER | INITIATOR_SELF | INITIATOR_CHOOSE
 *  - domain/enums/MultiMode       ALL(会签) | ANY(或签)
 *  - domain/enums/RejectStrategy  TO_INITIATOR | TO_PREVIOUS_NODE | TERMINATE
 *  - domain/model/NodeProps、AssigneeConfig、FlowNode、FlowEdge
 *  - domain/model/ProcessUser     {id, name, role}
 *  - domain/model/ProcessRole     {code, name}
 *  - common/R                     {code, msg, data}，code === 0 为成功
 */

export type NodeType = 'START' | 'APPROVAL' | 'CC' | 'END'

export type AssigneeType = 'USER' | 'ROLE' | 'DEPT_LEADER' | 'INITIATOR_SELF' | 'INITIATOR_CHOOSE'

export type MultiMode = 'ALL' | 'ANY'

export type RejectStrategy = 'TO_INITIATOR' | 'TO_PREVIOUS_NODE' | 'TERMINATE'

export interface ProcessUser {
  id: number
  name: string
  role: string
}

export interface ProcessRole {
  code: string
  name: string
}

export interface AssigneeConfig {
  userIds?: number[]
  roleCodes?: string[]
}

export interface NodeProps {
  assigneeType?: AssigneeType
  assigneeConfig?: AssigneeConfig
  multiMode?: MultiMode
  allowReject?: boolean
  rejectStrategy?: RejectStrategy
  allowTransfer?: boolean
  /** CC 节点直接读 props.userIds（后端 NodeProps 注释约定） */
  userIds?: number[]
}

export interface FlowNode {
  id: string
  type: NodeType
  name: string
  props?: NodeProps
  /** 画布坐标，仅供设计器回显，不参与流程语义 */
  x?: number
  y?: number
}

export interface FlowEdge {
  source: string
  target: string
  condition?: string | null
}

export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface DefinitionVO {
  id?: number
  code: string
  name: string
  description?: string
  version?: number
  graphJson?: string
  enabled?: number | boolean
}

export interface R<T> {
  code: number
  msg: string
  data: T
}

/** 实例状态，与后端 InstanceStatus 枚举对齐 */
export type InstanceStatus = 'RUNNING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface InstanceVO {
  instanceId: number
  defId: number
  defVersion: number
  title: string
  businessKey?: string
  initiatorId: number
  currentNodeKey: string
  currentRound: number
  status: InstanceStatus
  /** yyyy-MM-dd HH:mm:ss */
  startTime?: string
  endTime?: string
  /** 撤回按钮态提示：RUNNING 且无任何已处理审批任务。仅前端提示用，权威校验在后端 */
  canWithdraw?: boolean
}

export interface TaskVO {
  taskId: number
  instanceId: number
  instanceTitle?: string
  nodeKey: string
  nodeName?: string
  assigneeId: number
  status: string
  round: number
  createTime?: string
}

export type RecordAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CC' | 'CANCEL' | 'FINISH'

export interface TaskRecordVO {
  id: number
  instanceId: number
  taskId?: number
  nodeKey: string
  nodeName?: string
  operatorId: number
  action: RecordAction
  comment?: string
  round: number
  createTime: string
}
