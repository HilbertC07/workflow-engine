package com.jiatai.workflow.engine;

import com.jiatai.workflow.dto.DefinitionSaveRequest;
import com.jiatai.workflow.dto.InstanceStartRequest;
import com.jiatai.workflow.dto.InstanceVO;
import com.jiatai.workflow.dto.TaskVO;
import com.jiatai.workflow.service.DefinitionService;
import com.jiatai.workflow.service.InstanceService;
import com.jiatai.workflow.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * M3 新增查询接口的测试：
 * 1. 缺口1：/instance/my —— 按发起人查、startTime 倒序、status 过滤、非法 status 静默忽略
 * 2. 缺口2：/task/done —— 排除 PENDING、按处理时间倒序
 * 3. definition/list —— 只回 ENABLED 且每 code 最新版本
 * 4. canWithdraw —— 无人处理时 true，有人处理后 false
 */
class M3QueryApiTest extends BaseEngineTest {

    @Autowired private DefinitionService definitionService;
    @Autowired private InstanceService instanceService;
    @Autowired private TaskService taskService;

    private static final String GRAPH = """
{"nodes":[
  {"id":"start_1","type":"START","name":"开始","props":{}},
  {"id":"approve_1","type":"APPROVAL","name":"主管审批","props":{"assigneeType":"USER","assigneeConfig":{"userIds":[1002]},"multiMode":"ANY","allowReject":true,"rejectStrategy":"TERMINATE","allowTransfer":false}},
  {"id":"end_1","type":"END","name":"结束","props":{}}
],"edges":[
  {"source":"start_1","target":"approve_1","condition":null},
  {"source":"approve_1","target":"end_1","condition":null}
]}""";

    private String uniqueCode() {
        return "m3_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private DefinitionSaveRequest newDef(String code) {
        DefinitionSaveRequest req = new DefinitionSaveRequest();
        req.setCode(code);
        req.setName("M3测试流程");
        req.setGraphJson(GRAPH);
        return req;
    }

    private InstanceStartRequest newInst(String code, Long initiatorId, String title) {
        InstanceStartRequest req = new InstanceStartRequest();
        req.setDefCode(code);
        req.setInitiatorId(initiatorId);
        req.setTitle(title);
        return req;
    }

    @Test
    void shouldListMyInstancesOrderedByStartTimeDescWithStatusFilter() {
        String code = uniqueCode();
        definitionService.save(newDef(code));
        instanceService.start(newInst(code, 1001L, "我的申请A"));
        instanceService.start(newInst(code, 1001L, "我的申请B"));
        instanceService.start(newInst(code, 1002L, "别人的申请"));

        List<InstanceVO> all = instanceService.listMy(1001L, null);
        assertEquals(2, all.size());
        // startTime 倒序：后发起的在前
        assertEquals("我的申请B", all.get(0).getTitle());
        assertEquals("我的申请A", all.get(1).getTitle());
        // 列表接口也要填充 canWithdraw
        assertNotNull(all.get(0).getCanWithdraw());

        // status 过滤：RUNNING 只剩运行中的
        List<InstanceVO> running = instanceService.listMy(1001L, "RUNNING");
        assertEquals(2, running.size());

        // 非法 status 静默忽略，等同未传
        List<InstanceVO> invalid = instanceService.listMy(1001L, "NOT_A_STATUS");
        assertEquals(2, invalid.size());
    }

    @Test
    void shouldListDoneTasksExcludingPendingOrderedByFinishTimeDesc() {
        String code = uniqueCode();
        definitionService.save(newDef(code));
        InstanceVO inst1 = instanceService.start(newInst(code, 1001L, "已办测试1"));
        InstanceVO inst2 = instanceService.start(newInst(code, 1001L, "已办测试2"));

        // 1002 还没有已办
        List<TaskVO> doneBefore = taskService.listDone(1002L);
        assertTrue(doneBefore.stream().noneMatch(t -> inst1.getInstanceId().equals(t.getInstanceId())));

        // 1002 处理第一条：同意
        List<TaskVO> todo = taskService.listTodo(1002L);
        TaskVO t1 = todo.stream().filter(t -> inst1.getInstanceId().equals(t.getInstanceId())).findFirst().orElseThrow();
        taskService.approve(t1.getTaskId(), 1002L, "同意1");

        // 再发起并处理第二条，保证 done 里有两条且倒序
        InstanceVO inst3 = instanceService.start(newInst(code, 1001L, "已办测试3"));
        List<TaskVO> todo2 = taskService.listTodo(1002L);
        TaskVO t3 = todo2.stream().filter(t -> inst3.getInstanceId().equals(t.getInstanceId())).findFirst().orElseThrow();
        taskService.approve(t3.getTaskId(), 1002L, "同意3");

        List<TaskVO> done = taskService.listDone(1002L);
        List<TaskVO> mine = done.stream()
                .filter(t -> List.of(inst1.getInstanceId(), inst3.getInstanceId()).contains(t.getInstanceId()))
                .toList();
        assertEquals(2, mine.size());
        // finishTime 倒序：后处理的在前
        assertEquals(inst3.getInstanceId(), mine.get(0).getInstanceId());
        assertEquals(inst1.getInstanceId(), mine.get(1).getInstanceId());

        // inst2 未处理，不在已办中
        assertTrue(done.stream().noneMatch(t -> inst2.getInstanceId().equals(t.getInstanceId())));
    }

    @Test
    void shouldListOnlyEnabledLatestDefinitions() {
        String code = uniqueCode();
        definitionService.save(newDef(code));
        // 同 code 再保存一次 → version+1，旧版本被置 DISABLED
        definitionService.save(newDef(code));

        List<com.jiatai.workflow.dto.DefinitionVO> list = definitionService.listEnabled();
        List<com.jiatai.workflow.dto.DefinitionVO> mine = list.stream()
                .filter(d -> code.equals(d.getCode())).toList();
        assertEquals(1, mine.size());
        assertEquals(Integer.valueOf(2), mine.get(0).getVersion());
        assertEquals("ENABLED", mine.get(0).getStatus());
    }

    @Test
    void shouldComputeCanWithdrawCorrectly() {
        String code = uniqueCode();
        definitionService.save(newDef(code));
        InstanceVO inst = instanceService.start(newInst(code, 1001L, "撤回测试"));

        // 无人处理 → true
        InstanceVO before = instanceService.getById(inst.getInstanceId());
        assertEquals(Boolean.TRUE, before.getCanWithdraw());

        // 1002 同意（无 CC，流程直接结束）→ 非 RUNNING，false
        List<TaskVO> todo = taskService.listTodo(1002L);
        taskService.approve(todo.get(0).getTaskId(), 1002L, "同意");
        InstanceVO after = instanceService.getById(inst.getInstanceId());
        assertEquals("APPROVED", after.getStatus());
        assertEquals(Boolean.FALSE, after.getCanWithdraw());

        // 另发起一条，让 1002 驳回前保持 RUNNING 且已有人处理 → canWithdraw=false
        InstanceVO inst2 = instanceService.start(newInst(code, 1003L, "撤回测试2"));
        List<TaskVO> todo2 = taskService.listTodo(1002L);
        TaskVO t = todo2.stream().filter(x -> inst2.getInstanceId().equals(x.getInstanceId())).findFirst().orElseThrow();
        taskService.reject(t.getTaskId(), 1002L, "驳回");
        // TERMINATE 策略：实例直接 REJECTED
        InstanceVO after2 = instanceService.getById(inst2.getInstanceId());
        assertEquals("REJECTED", after2.getStatus());
        assertEquals(Boolean.FALSE, after2.getCanWithdraw());
    }
}
