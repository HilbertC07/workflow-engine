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
      // 锚点常显，见下方 setHovered 注释
      this.isShowAnchor = true
    }

    /**
     * 锚点常显。
     * LogicFlow 默认由 hover 态（setHovered → setIsShowAnchor）驱动锚点显隐，
     * 连线拖拽中鼠标离开源节点会让锚点组件被 Preact 卸载重建，
     * 重建后 Anchor 实例的 state（dragging/endX/endY）归零 →
     * isShowLine() 恒 false（无临时连线）且 checkEnd() 因 dragging=false 直接 return，
     * 表现为「锚点拖得动但连不出线」。这里切断 hover 对锚点显隐的控制，
     * 配合 initNodeData 中的 isShowAnchor=true 让锚点组件在拖拽全程保持同一实例。
     */
    setHovered(flag: boolean) {
      this.isHovered = flag
    }

    getDefaultAnchor() {
      const { id, x, y, width } = this
      return [
        { x: x - width / 2, y, id: `${id}_l` },
        { x: x + width / 2, y, id: `${id}_r` },
      ]
    }

    /**
     * 连线方向约束：只能从右侧锚点连出。
     * 注意 LogicFlow 的 validate 签名是 (source, target, sourceAnchor, targetAnchor, edgeId)，
     * 第 2 个参数是「目标节点」不是锚点——写成 (source, anchor) 会永远校验失败并静默拒绝连线。
     */
    getConnectedSourceRules() {
      return super.getConnectedSourceRules().concat([
        {
          message: '只能从节点右侧锚点连线',
          validate: (_source: unknown, _target: unknown, sourceAnchor: any) =>
            String(sourceAnchor?.id ?? '').endsWith('_r'),
        },
      ])
    }

    getConnectedTargetRules() {
      return super.getConnectedTargetRules().concat([
        {
          message: '只能连入节点左侧锚点',
          validate: (
            _target: unknown,
            _source: unknown,
            _sourceAnchor: unknown,
            targetAnchor: any,
          ) => String(targetAnchor?.id ?? '').endsWith('_l'),
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
