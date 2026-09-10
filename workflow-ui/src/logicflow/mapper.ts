import type { FlowGraph, NodeProps, NodeType } from '@/types/workflow'

/** LogicFlow 节点 type <-> 后端 NodeType 大写枚举 */
export const LF_TYPE_TO_ENUM: Record<string, NodeType> = {
  'start-node': 'START',
  'approval-node': 'APPROVAL',
  'cc-node': 'CC',
  'end-node': 'END',
}

export const ENUM_TO_LF_TYPE: Record<NodeType, string> = {
  START: 'start-node',
  APPROVAL: 'approval-node',
  CC: 'cc-node',
  END: 'end-node',
}

/** props 白名单：只放配置字段，不把 LogicFlow 私有字段塞进 graphJson */
const APPROVAL_PROP_KEYS = [
  'assigneeType',
  'assigneeConfig',
  'multiMode',
  'allowReject',
  'rejectStrategy',
  'allowTransfer',
]
const CC_PROP_KEYS = ['userIds']

interface LfNodeData {
  id: string
  type: string
  x: number
  y: number
  text?: unknown
  properties?: { name?: string; props?: NodeProps }
}

interface LfGraphData {
  nodes: LfNodeData[]
  edges: Array<{ sourceNodeId: string; targetNodeId: string }>
}

function textValue(text: unknown): string {
  if (typeof text === 'string') return text
  return (text as { value?: string } | undefined)?.value ?? ''
}

function pickProps(lfType: string, properties: LfNodeData['properties']): NodeProps {
  const src = (properties?.props ?? {}) as Record<string, unknown>
  const keys = lfType === 'approval-node' ? APPROVAL_PROP_KEYS : lfType === 'cc-node' ? CC_PROP_KEYS : []
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key]
  }
  return out as NodeProps
}

/** 保存映射：lf.getGraphData() -> 后端 FlowGraph（必须带 x/y，坐标否则回显全叠原点） */
export function toBackendGraph(lfData: LfGraphData): FlowGraph {
  return {
    nodes: lfData.nodes.map((n) => ({
      id: n.id,
      type: LF_TYPE_TO_ENUM[n.type] ?? 'APPROVAL',
      name: textValue(n.text) || n.properties?.name || '',
      props: pickProps(n.type, n.properties),
      x: n.x,
      y: n.y,
    })),
    edges: lfData.edges.map((e) => ({
      source: e.sourceNodeId,
      target: e.targetNodeId,
      condition: null,
    })),
  }
}

/** 加载映射：后端 FlowGraph -> lf.render({nodes, edges})，x/y 还原回画布坐标 */
export function toLfData(graph: FlowGraph) {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: ENUM_TO_LF_TYPE[n.type] ?? 'approval-node',
      x: n.x ?? 300,
      y: n.y ?? 200,
      text: n.name,
      properties: { name: n.name, props: n.props ?? {} },
    })),
    edges: graph.edges.map((e) => ({
      sourceNodeId: e.source,
      targetNodeId: e.target,
    })),
  }
}

/**
 * 前端四项快速校验（不做环检测/审批人可解析性，那些归后端 GraphParser）：
 * 1. START 数量必须恰好为 1；2. 必须有 END；3. 必须有审批节点；4. 不能有孤立节点
 */
export function validateBackendGraph(graph: FlowGraph): string[] {
  const errors: string[] = []
  const startCount = graph.nodes.filter((n) => n.type === 'START').length
  if (startCount === 0) errors.push('缺少开始节点')
  else if (startCount > 1) errors.push('开始节点只能有一个')
  if (!graph.nodes.some((n) => n.type === 'END')) errors.push('缺少结束节点')
  if (!graph.nodes.some((n) => n.type === 'APPROVAL')) errors.push('缺少审批节点')

  const linked = new Set<string>()
  for (const e of graph.edges) {
    linked.add(e.source)
    linked.add(e.target)
  }
  const isolated = graph.nodes.filter((n) => !linked.has(n.id))
  if (isolated.length > 0) {
    errors.push(`存在孤立节点：${isolated.map((n) => n.name || n.id).join('、')}`)
  }
  return errors
}
