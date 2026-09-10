package com.jiatai.workflow.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.jiatai.workflow.common.BizException;
import com.jiatai.workflow.domain.enums.NodeType;
import com.jiatai.workflow.domain.enums.TaskStatus;
import com.jiatai.workflow.domain.entity.WfProcessInstance;
import com.jiatai.workflow.domain.entity.WfTask;
import com.jiatai.workflow.dto.InstanceVO;
import com.jiatai.workflow.dto.TaskVO;
import com.jiatai.workflow.engine.ProcessEngine;
import com.jiatai.workflow.mapper.WfProcessInstanceMapper;
import com.jiatai.workflow.mapper.WfTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final WfTaskMapper taskMapper;
    private final WfProcessInstanceMapper instanceMapper;
    private final ProcessEngine processEngine;
    private final InstanceService instanceService;

    public TaskService(WfTaskMapper taskMapper, WfProcessInstanceMapper instanceMapper,
                       ProcessEngine processEngine, InstanceService instanceService) {
        this.taskMapper = taskMapper;
        this.instanceMapper = instanceMapper;
        this.processEngine = processEngine;
        this.instanceService = instanceService;
    }

    public List<TaskVO> listTodo(Long assigneeId) {
        List<WfTask> list = taskMapper.selectList(new LambdaQueryWrapper<WfTask>()
                .eq(WfTask::getAssigneeId, assigneeId)
                .eq(WfTask::getStatus, TaskStatus.PENDING)
                .eq(WfTask::getNodeType, NodeType.APPROVAL)
                .orderByDesc(WfTask::getCreateTime));
        return list.stream().map(this::toVO).collect(Collectors.toList());
    }

    /**
     * 同意。返回推进后的实例状态——调用方（M3 待办页）需要据此判断流程是否已结束，
     * 否则得再查一次实例接口。
     */
    @Transactional(rollbackFor = Exception.class)
    public InstanceVO approve(Long taskId, Long operatorId, String comment) {
        WfTask task = requireTask(taskId);
        processEngine.approve(taskId, operatorId, comment);
        return instanceService.getById(task.getInstanceId());
    }

    @Transactional(rollbackFor = Exception.class)
    public InstanceVO reject(Long taskId, Long operatorId, String comment) {
        WfTask task = requireTask(taskId);
        processEngine.reject(taskId, operatorId, comment);
        return instanceService.getById(task.getInstanceId());
    }

    private WfTask requireTask(Long taskId) {
        WfTask task = taskMapper.selectById(taskId);
        if (task == null) throw new BizException("WF_TASK_NOT_FOUND", "任务不存在");
        return task;
    }

    private TaskVO toVO(WfTask t) {
        TaskVO vo = new TaskVO();
        vo.setTaskId(t.getId());
        vo.setInstanceId(t.getInstanceId());
        WfProcessInstance inst = instanceMapper.selectById(t.getInstanceId());
        vo.setInstanceTitle(inst != null ? inst.getTitle() : null);
        vo.setNodeKey(t.getNodeKey());
        vo.setNodeName(t.getNodeName());
        vo.setAssigneeId(t.getAssigneeId());
        vo.setStatus(t.getStatus().name());
        vo.setRound(t.getRound());
        vo.setCreateTime(t.getCreateTime() != null ? t.getCreateTime().format(FMT) : null);
        return vo;
    }
}
