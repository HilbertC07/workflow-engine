import type LogicFlow from '@logicflow/core'
import { createModel, createView } from './nodes'

/** 注册四个自定义节点（register 三件套：{type, view, model}） */
export function registerWfNodes(lf: LogicFlow) {
  lf.register({ type: 'start-node', view: createView('start-node'), model: createModel('start-node') })
  lf.register({ type: 'approval-node', view: createView('approval-node'), model: createModel('approval-node') })
  lf.register({ type: 'cc-node', view: createView('cc-node'), model: createModel('cc-node') })
  lf.register({ type: 'end-node', view: createView('end-node'), model: createModel('end-node') })
}
