import { h, RectNode, RectNodeModel } from '@logicflow/core'

export interface NodeTheme {
  fill: string
  stroke: string
  textColor: string
}

/** 四种节点的配色：开始灰 / 审批蓝 / 抄送橙 / 结束绿 */
export const NODE_THEMES: Record<string, NodeTheme> = {
  'start-node': { fill: '#f4f4f5', stroke: '#909399', textColor: '#606266' },
  'approval-node': { fill: '#ecf5ff', stroke: '#409eff', textColor: '#409eff' },
  'cc-node': { fill: '#fdf6ec', stroke: '#e6a23c', textColor: '#e6a23c' },
  'end-node': { fill: '#f0f9eb', stroke: '#67c23a', textColor: '#67c23a' },
}

/**
 * 按类型生成 model 类：
 * - 节点文案取 properties.name（属性面板改名后由 lf.updateText 同步）
 * - 锚点只保留左（入）/右（出）两个
 * - 连线方向约束：只能从右侧锚点连出、左侧锚点连入
 */
export function createModel(lfType: string) {
  const theme = NODE_THEMES[lfType]
  return class WfNodeModel extends RectNodeModel {
    initNodeData(data: any) {
      super.initNodeData(data)
      this.width = 160
      this.height = 56
      const name = data.properties?.name
      this.text = name ?? (typeof data.text === 'string' ? data.text : data.text?.value ?? '')
    }

    getDefaultAnchor() {
      const { id, x, y, width } = this
      return [
        { x: x - width / 2, y, id: `${id}_l` },
        { x: x + width / 2, y, id: `${id}_r` },
      ]
    }

    getConnectedSourceRules() {
      return super.getConnectedSourceRules().concat([
        {
          message: '只能从节点右侧锚点连线',
          validate: (_sourceNode: unknown, sourceAnchor: any) => String(sourceAnchor.id).endsWith('_r'),
        },
      ])
    }

    getConnectedTargetRules() {
      return super.getConnectedTargetRules().concat([
        {
          message: '只能连入节点左侧锚点',
          validate: (_targetNode: unknown, targetAnchor: any) => String(targetAnchor.id).endsWith('_l'),
        },
      ])
    }

    getNodeStyle() {
      const style = super.getNodeStyle()
      style.fill = theme.fill
      style.stroke = theme.stroke
      style.strokeWidth = 1.5
      return style
    }

    getTextStyle() {
      const style = super.getTextStyle()
      style.color = theme.textColor
      style.fontSize = 13
      return style
    }
  }
}

/** 按类型生成 view 类：审批节点额外渲染「会签 / 或签」小标签 */
export function createView(lfType: string) {
  const theme = NODE_THEMES[lfType]
  return class WfNodeView extends RectNode {
    getShape() {
      const model = (this.props as any).model
      const { x, y, width, height } = model
      const style = model.getNodeStyle()
      const children: any[] = [
        h('rect', {
          ...style,
          x: x - width / 2,
          y: y - height / 2,
          width,
          height,
          rx: 6,
          ry: 6,
        }),
      ]
      if (lfType === 'approval-node') {
        const mode = (model.properties?.props as any)?.multiMode
        if (mode === 'ALL' || mode === 'ANY') {
          children.push(
            h(
              'text',
              {
                x,
                y: y + height / 2 - 9,
                fill: theme.textColor,
                fontSize: 10,
                textAnchor: 'middle',
                style: { pointerEvents: 'none' },
              },
              mode === 'ALL' ? '会签' : '或签',
            ),
          )
        }
      }
      return h('g', {}, children)
    }
  }
}
