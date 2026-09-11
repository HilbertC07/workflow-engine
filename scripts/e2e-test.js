const BASE = (process.env.WF_API_URL || 'http://localhost:8080') + '/api/workflow';

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { http: r.status, body: j };
}

function graph(nodes, edges) { return JSON.stringify({ nodes, edges }); }

const N = (id, type, name, props) => ({ id, type, name, props: props || {} });
const E = (s, t) => ({ source: s, target: t, condition: null });

// START 节点 id 故意不用 start_1，验证 Bug1（硬编码 start_1）是否真修好
const g1 = graph(
  [
    N('start_x9', 'START', '开始'),
    N('ap_1', 'APPROVAL', '部门主管审批', {
      assigneeType: 'USER', assigneeConfig: { userIds: [1002] },
      multiMode: 'ALL', allowReject: true, rejectStrategy: 'TO_INITIATOR', allowTransfer: false
    }),
    N('cc_1', 'CC', '抄送人事', { userIds: [1003] }),
    N('end_1', 'END', '结束')
  ],
  [E('start_x9', 'ap_1'), E('ap_1', 'cc_1'), E('cc_1', 'end_1')]
);

const g2 = graph(
  [
    N('start_a1', 'START', '开始'),
    N('ap_1', 'APPROVAL', '会签审批', {
      assigneeType: 'USER', assigneeConfig: { userIds: [1002, 1004] },
      multiMode: 'ALL', allowReject: true, rejectStrategy: 'TO_INITIATOR', allowTransfer: false
    }),
    N('end_1', 'END', '结束')
  ],
  [E('start_a1', 'ap_1'), E('ap_1', 'end_1')]
);

const show = (t, r) => console.log(`  [${t}] http=${r.http} ` + JSON.stringify(r.body).slice(0, 300));

(async () => {
  console.log('\n========== 场景 A：单人请假闭环（START 节点 id = start_x9，非 start_1）==========');
  let r = await req('POST', '/definition/save', { code: 'leave_e2e', name: '请假E2E', graphJson: g1 });
  show('保存定义', r);
  const defId = r.body?.data?.definitionId ?? r.body?.data?.id;

  r = await req('POST', '/instance/start', { defCode: 'leave_e2e', initiatorId: 1001, title: '张三请假' });
  show('发起实例', r);
  const instId = r.body?.data?.instanceId ?? r.body?.data?.id;
  console.log('  >>> instanceId =', instId, ' currentNodeKey =', r.body?.data?.currentNodeKey);

  r = await req('GET', '/task/todo?assigneeId=1002');
  show('李四待办', r);
  const taskId = r.body?.data?.[0]?.id ?? r.body?.data?.[0]?.taskId;
  console.log('  >>> taskId =', taskId);

  r = await req('POST', `/task/${taskId}/approve`, { operatorId: 1002, comment: '同意' });
  show('李四同意', r);

  r = await req('GET', `/instance/${instId}`);
  show('实例状态', r);
  console.log('  >>> 期望 status=APPROVED');

  r = await req('GET', `/instance/${instId}/records`);
  show('流转流水', r);
  const acts = (r.body?.data || []).map(x => x.action).join(' → ');
  console.log('  >>> 时间线：', acts);

  console.log('\n========== 场景 B：两人会签 + 一人已同意后撤回（验证 Bug2 应被拒绝）==========');
  r = await req('POST', '/definition/save', { code: 'multi_e2e', name: '会签E2E', graphJson: g2 });
  show('保存定义', r);

  r = await req('POST', '/instance/start', { defCode: 'multi_e2e', initiatorId: 1001, title: '会签测试' });
  show('发起实例', r);
  const inst2 = r.body?.data?.instanceId ?? r.body?.data?.id;

  r = await req('GET', '/task/todo?assigneeId=1002');
  const list2 = r.body?.data || [];
  console.log('  >>> 李四待办条数 =', list2.length, JSON.stringify(list2.map(x => ({ id: x.taskId ?? x.id, inst: x.instanceId }))));
  const t2 = list2.find(x => x.instanceId === inst2) || list2[0];
  const t2id = t2?.taskId ?? t2?.id;
  console.log('  >>> 李四任务 id =', t2id);

  r = await req('POST', `/task/${t2id}/approve`, { operatorId: 1002, comment: '李四同意' });
  show('李四同意（流程应仍 RUNNING）', r);
  const approveOk = r.body?.code === 0;
  console.log('  >>> 同意是否成功：', approveOk ? '成功' : '失败，后续撤回验证无意义');

  r = await req('GET', `/instance/${inst2}`);
  console.log('  >>> 同意后实例状态 =', r.body?.data?.status);

  r = await req('POST', `/instance/${inst2}/cancel`, { operatorId: 1001, comment: '想撤回' });
  show('张三撤回（期望被拒绝）', r);
  // 判定依据用返回码，不要匹配中文文案（后端改措辞就会误报）
  const rejected = r.body?.code !== 0;
  console.log('  >>> Bug2 修复验证：', rejected ? `✅ 已拒绝（修复生效，code=${r.body?.code}）` : '❌ 撤回成功了 = bug 仍在！');

  console.log('\n========== 场景 C：无人处理时撤回（应成功）==========');
  r = await req('POST', '/instance/start', { defCode: 'multi_e2e', initiatorId: 1001, title: '正常撤回测试' });
  show('发起实例', r);
  const inst3 = r.body?.data?.instanceId ?? r.body?.data?.id;

  r = await req('POST', `/instance/${inst3}/cancel`, { operatorId: 1001, comment: '不申请了' });
  show('撤回（期望成功）', r);

  r = await req('GET', `/instance/${inst3}`);
  show('实例状态', r);
  console.log('  >>> 期望 status=CANCELLED');
  console.log('\n========== 完成 ==========');
})();
