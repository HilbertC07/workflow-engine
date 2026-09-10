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
