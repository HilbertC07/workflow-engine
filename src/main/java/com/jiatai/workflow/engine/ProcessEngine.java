package com.jiatai.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jiatai.workflow.common.BizException;
import com.jiatai.workflow.domain.enums.*;
import com.jiatai.workflow.domain.model.AssigneeConfig;
import com.jiatai.workflow.domain.model.FlowGraph;
import com.jiatai.workflow.domain.model.FlowNode;
import com.jiatai.workflow.domain.model.NodeProps;
import com.jiatai.workflow.domain.entity.*;
import com.jiatai.workflow.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 流程引擎内核：推进状态机、CAS 防重、MAX_STEPS=100
 * 放在 engine 包根（规则十第 12 条），推进方法必须 public 且跨 Bean 调用
 */
@Service
public class ProcessEngine {

    private static final int MAX_STEPS = 100;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WfProcessInstanceMapper instanceMapper;
    private final WfTaskMapper taskMapper;
    private final WfTaskRecordMapper recordMapper;
    private final WfNodeDefinitionMapper nodeDefMapper;
    private final WfProcessDefinitionMapper defMapper;
    private final IdentityService identityService;

    public ProcessEngine(WfProcessInstanceMapper instanceMapper, WfTaskMapper taskMapper,
                         WfTaskRecordMapper recordMapper, WfNodeDefinitionMapper nodeDefMapper,
                         WfProcessDefinitionMapper defMapper, IdentityService identityService) {
        this.instanceMapper = instanceMapper;
        this.taskMapper = taskMapper;
        this.recordMapper = recordMapper;
        this.nodeDefMapper = nodeDefMapper;
        this.defMapper = defMapper;
        this.identityService = identityService;
    }

    /** 实例创建后回调，开始推进到第一个审批节点或结束 */
    @Transactional(rollbackFor = Exception.class)
    public void onInstanceCreated(Long instanceId) {
        WfProcessInstance inst = instanceMapper.selectById(instanceId);
        if (inst == null) throw new BizException("WF_INSTANCE_NOT_FOUND", "实例不存在");
        advanceLoop(inst);
    }

    /** 同意操作入口（事务内） */
    @Transactional(rollbackFor = Exception.class)
    public void approve(Long taskId, Long operatorId, String comment) {
        WfTask task = taskMapper.selectById(taskId);
        if (task == null) throw new BizException("WF_TASK_NOT_FOUND", "任务不存在");
        WfProcessInstance inst = instanceMapper.selectById(task.getInstanceId());
        if (inst == null || inst.getStatus() != InstanceStatus.RUNNING)
            throw new BizException("WF_INSTANCE_FINISHED", "实例已结束，无法操作");
        if (task.getStatus() != TaskStatus.PENDING)
            throw new BizException("WF_TASK_NOT_PENDING", "任务状态不正确");
        if (!Objects.equals(task.getAssigneeId(), operatorId))
            throw new BizException("WF_PERMISSION_DENIED", "你不是该任务的处理人");

        // CAS 更新
        int n = taskMapper.update(null,
                new LambdaUpdateWrapper<WfTask>()
                        .eq(WfTask::getId, taskId)
                        .eq(WfTask::getStatus, TaskStatus.PENDING)
                        .set(WfTask::getStatus, TaskStatus.APPROVED)
                        .set(WfTask::getAction, RecordAction.APPROVE.name())
                        .set(WfTask::getComment, comment)
                        .set(WfTask::getFinishTime, LocalDateTime.now()));
        if (n == 0) throw new BizException("WF_TASK_ALREADY_HANDLED", "该任务已被处理，请刷新后重试");

        // 写流水
        WfTaskRecord rec = new WfTaskRecord();
        rec.setInstanceId(inst.getId());
        rec.setTaskId(taskId);
        rec.setNodeKey(task.getNodeKey());
        rec.setNodeName(task.getNodeName());
        rec.setOperatorId(operatorId);
        rec.setAction(RecordAction.APPROVE);
        rec.setComment(comment);
        rec.setRound(task.getRound());
        rec.setCreateTime(LocalDateTime.now());
        recordMapper.insert(rec);

        // 判断节点是否完成，决定推进
        FlowGraph graph = loadGraph(inst.getDefId());
        FlowNode node = graph.node(task.getNodeKey());
        NodeProps props = node.getProps();
        MultiMode mode = props != null ? props.getMultiMode() : MultiMode.ALL;

        boolean shouldMove;
        if (mode == MultiMode.ALL) {
            // 会签：检查是否还有 PENDING
            long pending = countPendingTasks(inst.getId(), task.getNodeKey(), task.getRound());
            shouldMove = (pending == 0);
        } else {
            // 或签：一人同意即推进，其余 PENDING 置 CANCELLED
            cancelOtherPending(inst.getId(), task.getNodeKey(), task.getRound(), taskId);
            shouldMove = true;
        }
        if (shouldMove) {
            moveNextAndAdvance(inst, graph);
        }
    }

    /** 驳回操作入口（事务内） */
    @Transactional(rollbackFor = Exception.class)
    public void reject(Long taskId, Long operatorId, String comment) {
        WfTask task = taskMapper.selectById(taskId);
        if (task == null) throw new BizException("WF_TASK_NOT_FOUND", "任务不存在");
        WfProcessInstance inst = instanceMapper.selectById(task.getInstanceId());
        if (inst == null || inst.getStatus() != InstanceStatus.RUNNING)
            throw new BizException("WF_INSTANCE_FINISHED", "实例已结束，无法操作");
        if (task.getStatus() != TaskStatus.PENDING)
            throw new BizException("WF_TASK_NOT_PENDING", "任务状态不正确");
        if (!Objects.equals(task.getAssigneeId(), operatorId))
            throw new BizException("WF_PERMISSION_DENIED", "你不是该任务的处理人");

        // 检查节点 allowReject
        FlowGraph graph = loadGraph(inst.getDefId());
        FlowNode node = graph.node(task.getNodeKey());
        NodeProps props = node.getProps();
        if (props == null || Boolean.FALSE.equals(props.getAllowReject()))
            throw new BizException("WF_REJECT_NOT_ALLOWED", "当前节点不允许驳回");

        // CAS 置 REJECTED
        int n = taskMapper.update(null,
                new LambdaUpdateWrapper<WfTask>()
                        .eq(WfTask::getId, taskId)
                        .eq(WfTask::getStatus, TaskStatus.PENDING)
                        .set(WfTask::getStatus, TaskStatus.REJECTED)
                        .set(WfTask::getAction, RecordAction.REJECT.name())
                        .set(WfTask::getComment, comment)
                        .set(WfTask::getFinishTime, LocalDateTime.now()));
        if (n == 0) throw new BizException("WF_TASK_ALREADY_HANDLED", "该任务已被处理，请刷新后重试");

        // 写流水
        WfTaskRecord rec = new WfTaskRecord();
        rec.setInstanceId(inst.getId());
        rec.setTaskId(taskId);
        rec.setNodeKey(task.getNodeKey());
        rec.setNodeName(task.getNodeName());
        rec.setOperatorId(operatorId);
        rec.setAction(RecordAction.REJECT);
        rec.setComment(comment);
        rec.setRound(task.getRound());
        rec.setCreateTime(LocalDateTime.now());
        recordMapper.insert(rec);

        // 快速失败语义：本节点其余 PENDING 全部 CANCELLED（ALL/ANY 一致）
        cancelOtherPending(inst.getId(), task.getNodeKey(), task.getRound(), taskId);

        RejectStrategy strategy = props.getRejectStrategy();
        if (strategy == null) strategy = RejectStrategy.TO_INITIATOR;

        if (strategy == RejectStrategy.TERMINATE) {
            inst.setStatus(InstanceStatus.REJECTED);
            inst.setEndTime(LocalDateTime.now());
            instanceMapper.updateById(inst);
            WfTaskRecord fin = new WfTaskRecord();
            fin.setInstanceId(inst.getId());
            fin.setTaskId(taskId);
            fin.setNodeKey(task.getNodeKey());
            fin.setNodeName(task.getNodeName());
            fin.setOperatorId(operatorId);
            fin.setAction(RecordAction.FINISH);
            fin.setComment("驳回终止");
            fin.setRound(task.getRound());
            fin.setCreateTime(LocalDateTime.now());
            recordMapper.insert(fin);
        } else if (strategy == RejectStrategy.TO_INITIATOR) {
            // round+1，回第一个审批节点重新生成 PENDING
            inst.setCurrentRound(inst.getCurrentRound() + 1);
            String firstApprovalKey = findFirstApprovalNodeKey(graph);
            inst.setCurrentNodeKey(firstApprovalKey);
            instanceMapper.updateById(inst);
            // 用新 round 重新生成任务
            createApprovalTasks(inst, graph, firstApprovalKey, inst.getCurrentRound());
        } else {
            throw new BizException("WF_NOT_SUPPORTED", "TO_PREVIOUS_NODE 第一版暂不支持");
        }
    }

    /** 撤回实例（由 InstanceService 先校验权限，这里做数据变更） */
    @Transactional(rollbackFor = Exception.class)
    public void cancelInstance(Long instanceId, Long initiatorId) {
        WfProcessInstance inst = instanceMapper.selectById(instanceId);
        if (inst == null) throw new BizException("WF_INSTANCE_NOT_FOUND", "实例不存在");
        if (!Objects.equals(inst.getInitiatorId(), initiatorId))
            throw new BizException("WF_PERMISSION_DENIED", "只有发起人可以撤回");
        if (inst.getStatus() != InstanceStatus.RUNNING)
            throw new BizException("WF_INSTANCE_FINISHED", "实例已结束，无法撤回");

        // 撤回前置：审批任务必须全部未被处理（抄送任务天生 COMPLETED，不参与判断）
        long handled = taskMapper.selectCount(new LambdaQueryWrapper<WfTask>()
                .eq(WfTask::getInstanceId, instanceId)
                .eq(WfTask::getNodeType, NodeType.APPROVAL)
                .ne(WfTask::getStatus, TaskStatus.PENDING));
        if (handled > 0) {
            throw new BizException("WF_CANCEL_NOT_ALLOWED", "已有审批人处理了该申请，无法撤回");
        }

        // CAS 防重：RUNNING → CANCELLED
        int n = instanceMapper.update(null,
                new LambdaUpdateWrapper<WfProcessInstance>()
                        .eq(WfProcessInstance::getId, instanceId)
                        .eq(WfProcessInstance::getStatus, InstanceStatus.RUNNING)
                        .set(WfProcessInstance::getStatus, InstanceStatus.CANCELLED)
                        .set(WfProcessInstance::getEndTime, LocalDateTime.now()));
        if (n == 0) throw new BizException("WF_INSTANCE_ALREADY_CANCELLED", "实例已不在运行态");

        // 取消所有 PENDING 任务
        taskMapper.update(null,
                new LambdaUpdateWrapper<WfTask>()
                        .eq(WfTask::getInstanceId, instanceId)
                        .eq(WfTask::getStatus, TaskStatus.PENDING)
                        .set(WfTask::getStatus, TaskStatus.CANCELLED));

        // 写流水
        WfTaskRecord rec = new WfTaskRecord();
        rec.setInstanceId(instanceId);
        rec.setTaskId(null);
        rec.setNodeKey(inst.getCurrentNodeKey());
        rec.setNodeName("");
        rec.setOperatorId(initiatorId);
        rec.setAction(RecordAction.CANCEL);
        rec.setComment("发起人撤回");
        rec.setRound(inst.getCurrentRound());
        rec.setCreateTime(LocalDateTime.now());
        recordMapper.insert(rec);
    }

    /** 推进循环（private，事务已由 public 入口开启） */
    private void advanceLoop(WfProcessInstance inst) {
        for (int step = 0; step < MAX_STEPS; step++) {
            FlowGraph graph = loadGraph(inst.getDefId());
            FlowNode node = graph.node(inst.getCurrentNodeKey());
            switch (node.getType()) {
                case START -> {
                    String next = findNextKey(graph, inst.getCurrentNodeKey());
                    inst.setCurrentNodeKey(next);
                    instanceMapper.updateById(inst);
                }
                case CC -> {
                    // 抄送：立即生成 COMPLETED 任务 + CC 流水，然后前移
                    List<Long> ccUsers = extractCcUsers(node);
                    for (Long userId : ccUsers) {
                        WfTask t = new WfTask();
                        t.setInstanceId(inst.getId());
                        t.setNodeKey(node.getId());
                        t.setNodeName(node.getName());
                        t.setNodeType(NodeType.CC);
                        t.setAssigneeId(userId);
                        t.setStatus(TaskStatus.COMPLETED);
                        t.setRound(inst.getCurrentRound());
                        t.setCreateTime(LocalDateTime.now());
                        t.setFinishTime(LocalDateTime.now());
                        taskMapper.insert(t);

                        WfTaskRecord rec = new WfTaskRecord();
                        rec.setInstanceId(inst.getId());
                        rec.setTaskId(t.getId());
                        rec.setNodeKey(node.getId());
                        rec.setNodeName(node.getName());
                        rec.setOperatorId(userId);
                        rec.setAction(RecordAction.CC);
                        rec.setRound(inst.getCurrentRound());
                        rec.setCreateTime(LocalDateTime.now());
                        recordMapper.insert(rec);
                    }
                    String next = findNextKey(graph, inst.getCurrentNodeKey());
                    inst.setCurrentNodeKey(next);
                    instanceMapper.updateById(inst);
                }
                case APPROVAL -> {
                    // 解析审批人（空→抛异常整笔回滚）
                    createApprovalTasks(inst, graph, node.getId(), inst.getCurrentRound());
                    // 停在此节点，等待审批
                    return;
                }
                case END -> {
                    // 取最后一位审批人作为 FINISH operator
                    Long lastApprover = findLastApprover(inst.getId());
                    if (lastApprover == null) lastApprover = inst.getInitiatorId();

                    inst.setStatus(InstanceStatus.APPROVED);
                    inst.setEndTime(LocalDateTime.now());
                    instanceMapper.updateById(inst);

                    WfTaskRecord fin = new WfTaskRecord();
                    fin.setInstanceId(inst.getId());
                    fin.setTaskId(null);
                    fin.setNodeKey(node.getId());
                    fin.setNodeName(node.getName());
                    fin.setOperatorId(lastApprover);
                    fin.setAction(RecordAction.FINISH);
                    fin.setComment("流程结束");
                    fin.setRound(inst.getCurrentRound());
                    fin.setCreateTime(LocalDateTime.now());
                    recordMapper.insert(fin);
                    return;
                }
                default -> throw new BizException("WF_UNKNOWN_NODE", "未知节点类型");
            }
        }
        throw new BizException("WF_MAX_STEPS_EXCEEDED", "流程推进超过最大步数，可能存在环");
    }

    private void moveNextAndAdvance(WfProcessInstance inst, FlowGraph graph) {
        String next = findNextKey(graph, inst.getCurrentNodeKey());
        inst.setCurrentNodeKey(next);
        instanceMapper.updateById(inst);
        advanceLoop(inst);
    }

    private String findNextKey(FlowGraph graph, String current) {
        return graph.getEdges().stream()
                .filter(e -> e.getSource().equals(current))
                .findFirst()
                .orElseThrow(() -> new BizException("WF_GRAPH_INVALID", "节点" + current + "没有出线"))
                .getTarget();
    }

    private String findFirstApprovalNodeKey(FlowGraph graph) {
        return graph.getNodes().stream()
                .filter(n -> n.getType() == NodeType.APPROVAL)
                .findFirst()
                .orElseThrow(() -> new BizException("WF_GRAPH_INVALID", "图中没有审批节点"))
                .getId();
    }

    private void createApprovalTasks(WfProcessInstance inst, FlowGraph graph, String nodeKey, int round) {
        FlowNode node = graph.node(nodeKey);
        List<Long> approvers = resolveApprovers(inst, node);
        if (approvers.isEmpty()) {
            throw new BizException("WF_APPROVER_EMPTY", "该节点未找到审批人，请检查流程配置");
        }
        for (Long uid : approvers) {
            WfTask t = new WfTask();
            t.setInstanceId(inst.getId());
            t.setNodeKey(nodeKey);
            t.setNodeName(node.getName());
            t.setNodeType(NodeType.APPROVAL);
            t.setAssigneeId(uid);
            t.setStatus(TaskStatus.PENDING);
            t.setRound(round);
            t.setCreateTime(LocalDateTime.now());
            taskMapper.insert(t);
        }
    }

    private List<Long> resolveApprovers(WfProcessInstance inst, FlowNode node) {
        NodeProps props = node.getProps();
        if (props == null) return List.of();
        AssigneeType type = props.getAssigneeType();
        if (type == null) return List.of();

        return switch (type) {
            case USER -> {
                AssigneeConfig cfg = props.getAssigneeConfig();
                yield cfg != null && cfg.getUserIds() != null ? cfg.getUserIds() : List.of();
            }
            case ROLE -> {
                AssigneeConfig cfg = props.getAssigneeConfig();
                List<String> codes = cfg != null ? cfg.getRoleCodes() : null;
                yield codes != null ? identityService.listUsersByRoleCodes(codes) : List.of();
            }
            case DEPT_LEADER -> {
                Long leader = identityService.getDeptLeader(inst.getInitiatorId());
                yield leader != null ? List.of(leader) : List.of();
            }
            case INITIATOR_SELF -> List.of(inst.getInitiatorId());
            case INITIATOR_CHOOSE -> {
                Map<String, List<Long>> chosen = parseChosen(inst.getChosenUserIds());
                yield chosen.getOrDefault(node.getId(), List.of());
            }
        };
    }

    private AssigneeConfig parseCfg(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, AssigneeConfig.class);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<Long>> parseChosen(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<Long> extractCcUsers(FlowNode node) {
        NodeProps props = node.getProps();
        return props != null && props.getUserIds() != null ? props.getUserIds() : List.of();
    }

    private FlowGraph loadGraph(Long defId) {
        WfProcessDefinition def = defMapper.selectById(defId);
        if (def == null) throw new BizException("WF_DEF_NOT_FOUND", "定义不存在");
        try {
            return objectMapper.readValue(def.getGraphJson(), FlowGraph.class);
        } catch (Exception e) {
            throw new BizException("WF_GRAPH_INVALID", "流程图JSON解析失败");
        }
    }

    private long countPendingTasks(Long instanceId, String nodeKey, int round) {
        return taskMapper.selectCount(new LambdaQueryWrapper<WfTask>()
                .eq(WfTask::getInstanceId, instanceId)
                .eq(WfTask::getNodeKey, nodeKey)
                .eq(WfTask::getRound, round)
                .eq(WfTask::getStatus, TaskStatus.PENDING));
    }

    private void cancelOtherPending(Long instanceId, String nodeKey, int round, Long excludeTaskId) {
        List<WfTask> list = taskMapper.selectList(new LambdaQueryWrapper<WfTask>()
                .eq(WfTask::getInstanceId, instanceId)
                .eq(WfTask::getNodeKey, nodeKey)
                .eq(WfTask::getRound, round)
                .eq(WfTask::getStatus, TaskStatus.PENDING)
                .ne(WfTask::getId, excludeTaskId != null ? excludeTaskId : -1L));
        for (WfTask t : list) {
            taskMapper.update(null,
                    new LambdaUpdateWrapper<WfTask>()
                            .eq(WfTask::getId, t.getId())
                            .eq(WfTask::getStatus, TaskStatus.PENDING)
                            .set(WfTask::getStatus, TaskStatus.CANCELLED));
        }
    }

    private Long findLastApprover(Long instanceId) {
        List<WfTaskRecord> records = recordMapper.selectList(new LambdaQueryWrapper<WfTaskRecord>()
                .eq(WfTaskRecord::getInstanceId, instanceId)
                .in(WfTaskRecord::getAction, RecordAction.APPROVE.name(), RecordAction.REJECT.name())
                .orderByDesc(WfTaskRecord::getCreateTime));
        return records.isEmpty() ? null : records.get(0).getOperatorId();
    }
}
