package com.jiatai.workflow.engine;

import com.jiatai.workflow.domain.enums.InstanceStatus;
import com.jiatai.workflow.domain.enums.TaskStatus;
import com.jiatai.workflow.dto.DefinitionSaveRequest;
import com.jiatai.workflow.dto.InstanceStartRequest;
import com.jiatai.workflow.dto.TaskVO;
import com.jiatai.workflow.service.DefinitionService;
import com.jiatai.workflow.service.InstanceService;
import com.jiatai.workflow.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 四个核心场景单测：
 * 1. 会签：两人都同意才通过
 * 2. 或签：一人同意即通过
 * 3. 驳回回发起人：round+1，重新生成待办
 * 4. 抄送不阻塞：CC 节点自动完成并推进到结束
 */
@SpringBootTest
@ActiveProfiles("test")
class ProcessEngineTest {

    @Autowired private DefinitionService definitionService;
    @Autowired private InstanceService instanceService;
    @Autowired private TaskService taskService;

    @Test
    void shouldApproveWhenAllApproversAgree() {
        // 准备：两人会签节点 + 抄送 + 结束
        String graph = """
{"nodes":[
  {"id":"start_1","type":"START","name":"开始","props":{}},
  {"id":"approve_1","type":"APPROVAL","name":"主管审批","props":{"assigneeType":"USER","assigneeConfig":{"userIds":[1002,1004]},"multiMode":"ALL","allowReject":true,"rejectStrategy":"TO_INITIATOR","allowTransfer":false}},
  {"id":"cc_1","type":"CC","name":"抄送人事","props":{"userIds":[1003]}},
  {"id":"end_1","type":"END","name":"结束","props":{}}
],"edges":[
  {"source":"start_1","target":"approve_1","condition":null},
  {"source":"approve_1","target":"cc_1","condition":null},
  {"source":"cc_1","target":"end_1","condition":null}
]}""";
        var def = definitionService.save(newDef("leave_all", "会签请假", graph));
        var inst = instanceService.start(newInst(def.getCode(), 1001L, "会签测试"));

        // 1002 同意
        List<TaskVO> todo1002 = taskService.listTodo(1002L);
        assertEquals(1, todo1002.size());
        taskService.approve(todo1002.get(0).getTaskId(), 1002L, "李四同意");

        // 此时流程不应结束，1004 还有待办
        List<TaskVO> todo1004 = taskService.listTodo(1004L);
        assertEquals(1, todo1004.size());

        // 1004 同意 → 应经过抄送推到结束
        taskService.approve(todo1004.get(0).getTaskId(), 1004L, "赵六同意");

        var finalInst = instanceService.getById(inst.getInstanceId());
        assertEquals(InstanceStatus.APPROVED.name(), finalInst.getStatus());
    }

    @Test
    void shouldApproveWhenAnyApproverAgrees() {
        String graph = """
{"nodes":[
  {"id":"start_1","type":"START","name":"开始","props":{}},
  {"id":"approve_1","type":"APPROVAL","name":"或签审批","props":{"assigneeType":"USER","assigneeConfig":{"userIds":[1002,1004]},"multiMode":"ANY","allowReject":true,"rejectStrategy":"TO_INITIATOR","allowTransfer":false}},
  {"id":"cc_1","type":"CC","name":"抄送人事","props":{"userIds":[1003]}},
  {"id":"end_1","type":"END","name":"结束","props":{}}
],"edges":[
  {"source":"start_1","target":"approve_1","condition":null},
  {"source":"approve_1","target":"cc_1","condition":null},
  {"source":"cc_1","target":"end_1","condition":null}
]}""";
        var def = definitionService.save(newDef("leave_any", "或签请假", graph));
        var inst = instanceService.start(newInst(def.getCode(), 1001L, "或签测试"));

        // 1002 同意 → 应立即推进，1004 的 PENDING 置 CANCELLED
        List<TaskVO> todo1002 = taskService.listTodo(1002L);
        assertEquals(1, todo1002.size());
        taskService.approve(todo1002.get(0).getTaskId(), 1002L, "李四同意");

        var finalInst = instanceService.getById(inst.getInstanceId());
        assertEquals(InstanceStatus.APPROVED.name(), finalInst.getStatus());
    }

    @Test
    void shouldRollbackToInitiatorOnReject() {
        String graph = """
{"nodes":[
  {"id":"start_1","type":"START","name":"开始","props":{}},
  {"id":"approve_1","type":"APPROVAL","name":"主管审批","props":{"assigneeType":"USER","assigneeConfig":{"userIds":[1002]},"multiMode":"ALL","allowReject":true,"rejectStrategy":"TO_INITIATOR","allowTransfer":false}},
  {"id":"cc_1","type":"CC","name":"抄送人事","props":{"userIds":[1003]}},
  {"id":"end_1","type":"END","name":"结束","props":{}}
],"edges":[
  {"source":"start_1","target":"approve_1","condition":null},
  {"source":"approve_1","target":"cc_1","condition":null},
  {"source":"cc_1","target":"end_1","condition":null}
]}""";
        var def = definitionService.save(newDef("leave_reject", "驳回测试", graph));
        var inst = instanceService.start(newInst(def.getCode(), 1001L, "驳回测试"));

        // 1002 驳回
        List<TaskVO> todo1002 = taskService.listTodo(1002L);
        assertEquals(1, todo1002.size());
        taskService.reject(todo1002.get(0).getTaskId(), 1002L, "不同意，打回");

        // round 应变为 2，1002 再次有待办
        var inst2 = instanceService.getById(inst.getInstanceId());
        assertEquals(2, inst2.getCurrentRound());
        assertEquals(InstanceStatus.RUNNING.name(), inst2.getStatus());

        List<TaskVO> todo1002Round2 = taskService.listTodo(1002L);
        assertEquals(1, todo1002Round2.size());
        assertEquals(2, todo1002Round2.get(0).getRound());

        // 1002 同意 → 应走到结束
        taskService.approve(todo1002Round2.get(0).getTaskId(), 1002L, "第二轮同意");
        var finalInst = instanceService.getById(inst.getInstanceId());
        assertEquals(InstanceStatus.APPROVED.name(), finalInst.getStatus());
    }

    @Test
    void ccShouldNotBlockFlow() {
        String graph = """
{"nodes":[
  {"id":"start_1","type":"START","name":"开始","props":{}},
  {"id":"approve_1","type":"APPROVAL","name":"主管审批","props":{"assigneeType":"USER","assigneeConfig":{"userIds":[1002]},"multiMode":"ALL","allowReject":false,"allowTransfer":false}},
  {"id":"cc_1","type":"CC","name":"抄送人事","props":{"userIds":[1003]}},
  {"id":"end_1","type":"END","name":"结束","props":{}}
],"edges":[
  {"source":"start_1","target":"approve_1","condition":null},
  {"source":"approve_1","target":"cc_1","condition":null},
  {"source":"cc_1","target":"end_1","condition":null}
]}""";
        var def = definitionService.save(newDef("leave_cc", "抄送不阻塞", graph));
        var inst = instanceService.start(newInst(def.getCode(), 1001L, "抄送测试"));

        // 1002 同意 → 应自动经过抄送推到结束
        List<TaskVO> todo1002 = taskService.listTodo(1002L);
        assertEquals(1, todo1002.size());
        taskService.approve(todo1002.get(0).getTaskId(), 1002L, "同意");

        var finalInst = instanceService.getById(inst.getInstanceId());
        assertEquals(InstanceStatus.APPROVED.name(), finalInst.getStatus());

        // 抄送任务状态应为 COMPLETED
        List<TaskVO> ccTasks = taskService.listTodo(1003L); // 抄送不是 PENDING，查不到
        assertEquals(0, ccTasks.size());
    }

    private DefinitionSaveRequest newDef(String code, String name, String graph) {
        var req = new DefinitionSaveRequest();
        req.setCode(code);
        req.setName(name);
        req.setGraphJson(graph);
        return req;
    }

    private InstanceStartRequest newInst(String defCode, Long initiatorId, String title) {
        var req = new InstanceStartRequest();
        req.setDefCode(defCode);
        req.setInitiatorId(initiatorId);
        req.setTitle(title);
        return req;
    }
}
