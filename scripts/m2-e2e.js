/**
 * M2 咬合验证：用「前端 mapper.ts 产出的确切 JSON 格式」保存定义，
 * 再走完整的 发起 → 待办 → 会签同意 → 抄送 → 结束 闭环。
 * 目的：确认设计器画出来的图能真的驱动 M1 引擎，而不只是"保存成功"。
 */
const BASE = (process.env.WF_API_URL || 'http://localhost:8080') + '/api/workflow'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

function show(title, r, pick) {
  const d = r.body?.data
  const extra = pick && d ? pick(d) : ''
  console.log(`  ${r.body?.code === 0 ? '✅' : '❌'} ${title} ${extra}`)
  if (r.body?.code !== 0) console.log(`     msg: ${r.body?.msg}`)
  return d
}

// 严格按 mapper.ts 的 toBackendGraph 输出构造：
// - 节点带 x/y
// - APPROVAL 的 props 只有白名单六字段
// - CC 的 props 只有 userIds
// - START/END 的 props 是空对象
const graph = {
  nodes: [
    { id: 'start_a1', type: 'START', name: '开始', props: {}, x: 120, y: 200 },
    {
      id: 'ap_b2',
      type: 'APPROVAL',
      name: '主管审批',
      props: {
        assigneeType: 'USER',
        assigneeConfig: { userIds: [1002, 1004] },
        multiMode: 'ALL',
        allowReject: true,
        rejectStrategy: 'TO_INITIATOR',
        allowTransfer: false,
      },
      x: 340,
      y: 200,
    },
    { id: 'cc_c3', type: 'CC', name: '人事抄送', props: { userIds: [1003] }, x: 560, y: 200 },
    { id: 'end_d4', type: 'END', name: '结束', props: {}, x: 780, y: 200 },
  ],
  edges: [
    { source: 'start_a1', target: 'ap_b2', condition: null },
    { source: 'ap_b2', target: 'cc_c3', condition: null },
    { source: 'cc_c3', target: 'end_d4', condition: null },
  ],
}

async function main() {
  const code = 'designer_e2e_' + Date.now()
  console.log('=== 步骤1：设计器保存（前端格式，含 x/y）===')
  let r = await req('POST', '/definition/save', {
    code,
    name: '设计器产出流程',
    graphJson: JSON.stringify(graph),
  })
  const def = show('保存定义', r, (d) => `version=${d.version} status=${d.status}`)

  console.log('\n=== 步骤2：模拟刷新页面——加载回来，校验坐标不丢 ===')
  r = await req('GET', `/definition/${code}/latest-enabled`)
  const loaded = show('加载定义', r)
  const back = JSON.parse(loaded.graphJson)
  const coordOk = back.nodes.every((n, i) => n.x === graph.nodes[i].x && n.y === graph.nodes[i].y)
  console.log(`  ${coordOk ? '✅' : '❌'} 坐标还原：${coordOk ? '全部一致' : '不一致！'}`)
  console.log(`     坐标 => ${back.nodes.map((n) => `${n.id}(${n.x},${n.y})`).join(' ')}`)

  console.log('\n=== 步骤3：发起实例（节点 id 非 start_1，验证不依赖硬编码）===')
  r = await req('POST', '/instance/start', {
    defCode: code,
    initiatorId: 1001,
    title: '张三请假',
  })
  const inst = show('发起', r, (d) => `instanceId=${d.instanceId} 当前节点=${d.currentNodeKey}`)

  // 库里有历史测试数据，必须按本次 instanceId 过滤，否则会取到别的流程的任务
  const pickMine = (list, instId) => (list || []).filter((x) => x.instanceId === instId)

  console.log('\n=== 步骤4：会签——两人都应拿到待办 ===')
  r = await req('GET', '/task/todo?assigneeId=1002')
  const t1002 = pickMine(r.body?.data, inst.instanceId)
  console.log(`  ${t1002.length === 1 ? '✅' : '❌'} 李四待办 ${t1002.length} 条 ${t1002.map((x) => 'taskId=' + x.taskId).join()}`)
  r = await req('GET', '/task/todo?assigneeId=1004')
  const t1004 = pickMine(r.body?.data, inst.instanceId)
  console.log(`  ${t1004.length === 1 ? '✅' : '❌'} 赵六待办 ${t1004.length} 条 ${t1004.map((x) => 'taskId=' + x.taskId).join()}`)

  console.log('\n=== 步骤5：李四同意（会签未完，流程应仍在 RUNNING）===')
  r = await req('POST', `/task/${t1002[0].taskId}/approve`, { operatorId: 1002, comment: '同意' })
  const s5 = r.body?.data
  console.log(`  ${s5?.status === 'RUNNING' ? '✅' : '❌'} 李四同意 → status=${s5?.status} 当前节点=${s5?.currentNodeKey}`)

  console.log('\n=== 步骤6：赵六同意（会签完成 → 抄送穿透 → 结束）===')
  r = await req('POST', `/task/${t1004[0].taskId}/approve`, { operatorId: 1004, comment: '同意' })
  const s6 = r.body?.data
  console.log(`  ${s6?.status === 'APPROVED' ? '✅' : '❌'} 赵六同意 → status=${s6?.status} 当前节点=${s6?.currentNodeKey}`)

  console.log('\n=== 步骤7：时间线（应含 SUBMIT/APPROVE×2/CC/FINISH）===')
  r = await req('GET', `/instance/${inst.instanceId}/records`)
  const records = r.body?.data || []
  const actions = records.map((x) => x.action).join(' → ')
  console.log(`  ${records.length >= 5 ? '✅' : '❌'} 时间线：${actions}`)

  console.log('\n=== 结论 ===')
  const ok =
    coordOk &&
    inst?.instanceId &&
    t1002.length === 1 &&
    t1004.length === 1 &&
    s5?.status === 'RUNNING' &&
    s6?.status === 'APPROVED' &&
    records.length >= 5 &&
    records.some((x) => x.action === 'CC')
  console.log(ok ? '✅ 设计器产出 → 引擎闭环 全链路通过' : '❌ 存在失败环节，见上方 ❌')
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exit(1)
})
