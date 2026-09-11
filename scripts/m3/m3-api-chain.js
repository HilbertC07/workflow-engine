/**
 * M3 完整链路验证（纯后端 API，不依赖浏览器）
 * 1. 1001 发起 leave_e2e（单审批人流程）
 * 2. 立即查 canWithdraw（应为 true，无人处理）
 * 3. 查 initiatorId=1001 的 my 列表，新单 canWithdraw
 * 4. 审批人同意
 * 5. 再查 canWithdraw（应为 false）
 */
const BASE = (process.env.WF_API_URL || 'http://localhost:8080') + '/api/workflow'

async function req(method, path, body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opt.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opt)
  return r.json()
}

;(async () => {
  const stamp = Date.now()

  // 0. 取可用定义
  const defs = (await req('GET', '/definition/list')).data
  const target = defs.find((d) => d.code === 'leave_e2e')
  console.log('流程定义:', target ? `${target.code}(v${target.version})` : '未找到 leave_e2e')
  const graph = JSON.parse(target.graphJson)
  for (const n of graph.nodes) {
    console.log('  节点:', n.id, n.type, n.name, JSON.stringify(n.props))
  }

  // 1. 发起
  console.log('\n===== 1. 1001 发起 =====')
  const startRes = await req('POST', '/instance/start', {
    defCode: 'leave_e2e',
    initiatorId: 1001,
    title: 'M3链路验证单 ' + stamp,
  })
  console.log(JSON.stringify(startRes))
  if (startRes.code !== 0) { console.log('发起失败，终止'); return }
  const inst = startRes.data
  const instId = inst.instanceId

  // 2. 立即查 canWithdraw（未审批）
  console.log('\n===== 2. 未审批时 canWithdraw =====')
  const detail1 = await req('GET', `/instance/${instId}`)
  console.log('  instance/' + instId + ':', JSON.stringify(detail1.data))
  console.log('  → canWithdraw =', detail1.data.canWithdraw, '（期望 true）')

  const my1 = (await req('GET', '/instance/my?initiatorId=1001')).data
  const mine = my1.find((i) => i.instanceId === instId)
  console.log('  my 列表中该单:', JSON.stringify(mine))

  // 3. 查待办
  console.log('\n===== 3. 审批人待办 =====')
  const approvalNode = graph.nodes.find((n) => n.type === 'APPROVAL')
  const assignees = approvalNode.props?.assigneeConfig?.userIds ?? []
  console.log('  审批人:', JSON.stringify(assignees))
  for (const uid of assignees) {
    const todo = (await req('GET', `/task/todo?assigneeId=${uid}`)).data
    const hit = todo.find((t) => t.instanceId === instId)
    console.log(`  用户 ${uid} 待办含该单:`, hit ? `taskId=${hit.taskId} ${hit.nodeName} ${hit.status}` : '无')
  }

  // 4. 撤回测试（此时应可撤回）
  console.log('\n===== 4. 撤回（未审批，应成功）=====')
  const cancelRes = await req('POST', `/instance/${instId}/cancel`, { operatorId: 1001 })
  console.log('  撤回结果:', JSON.stringify(cancelRes).slice(0, 300))
  const detail2 = await req('GET', `/instance/${instId}`)
  console.log('  撤回后状态:', detail2.data?.status, 'canWithdraw =', detail2.data?.canWithdraw)

  // 5. 再起一单，走"审批后不可撤回"路径
  console.log('\n===== 5. 新起一单 → 审批 → 验证不可撤回 =====')
  const start2 = await req('POST', '/instance/start', {
    defCode: 'leave_e2e', initiatorId: 1001, title: 'M3审批后验证 ' + stamp,
  })
  const inst2 = start2.data
  console.log('  新实例:', inst2.instanceId, inst2.status)
  const d3 = await req('GET', `/instance/${inst2.instanceId}`)
  console.log('  审批前 canWithdraw =', d3.data.canWithdraw, '（期望 true）')

  const uid = assignees[0]
  const todo2 = (await req('GET', `/task/todo?assigneeId=${uid}`)).data
  const task2 = todo2.find((t) => t.instanceId === inst2.instanceId)
  if (task2) {
    const ap = await req('POST', `/task/${task2.taskId}/approve`, { operatorId: uid, comment: '同意' })
    console.log('  审批结果:', JSON.stringify(ap).slice(0, 250))
  }
  const d4 = await req('GET', `/instance/${inst2.instanceId}`)
  console.log('  审批后状态:', d4.data.status, 'canWithdraw =', d4.data.canWithdraw, '（期望 false）')

  const my2 = (await req('GET', '/instance/my?initiatorId=1001')).data
  const m2 = my2.find((i) => i.instanceId === inst2.instanceId)
  console.log('  my 列表:', JSON.stringify(m2))

  // 6. status 过滤
  console.log('\n===== 6. status 过滤 =====')
  const runOnly = (await req('GET', '/instance/my?initiatorId=1001&status=RUNNING')).data
  console.log('  RUNNING 单数:', runOnly.length, '状态集合:', [...new Set(runOnly.map((i) => i.status))])
  const bad = (await req('GET', '/instance/my?initiatorId=1001&status=NOT_A_STATUS')).data
  console.log('  非法 status 返回条数:', bad.length, '（应等于全部，即静默忽略）')
})().catch((e) => console.error('异常:', e.message))
