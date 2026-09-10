package com.jiatai.workflow.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jiatai.workflow.common.BizException;
import com.jiatai.workflow.domain.enums.DefinitionStatus;
import com.jiatai.workflow.domain.enums.InstanceStatus;
import com.jiatai.workflow.domain.entity.WfProcessDefinition;
import com.jiatai.workflow.domain.entity.WfProcessInstance;
import com.jiatai.workflow.domain.entity.WfTask;
import com.jiatai.workflow.domain.entity.WfTaskRecord;
import com.jiatai.workflow.domain.enums.NodeType;
import com.jiatai.workflow.domain.enums.RecordAction;
import com.jiatai.workflow.domain.model.FlowGraph;
import com.jiatai.workflow.dto.InstanceStartRequest;
import com.jiatai.workflow.dto.InstanceVO;
import com.jiatai.workflow.dto.TaskRecordVO;
import com.jiatai.workflow.engine.ProcessEngine;
import com.jiatai.workflow.engine.parser.GraphParser;
import com.jiatai.workflow.mapper.WfProcessDefinitionMapper;
import com.jiatai.workflow.mapper.WfProcessInstanceMapper;
import com.jiatai.workflow.mapper.WfTaskMapper;
import com.jiatai.workflow.mapper.WfTaskRecordMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class InstanceService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WfProcessDefinitionMapper defMapper;
    private final WfProcessInstanceMapper instanceMapper;
    private final WfTaskMapper taskMapper;
    private final WfTaskRecordMapper recordMapper;
    private final ProcessEngine processEngine;
    private final GraphParser graphParser;

    public InstanceService(WfProcessDefinitionMapper defMapper, WfProcessInstanceMapper instanceMapper,
                           WfTaskMapper taskMapper, WfTaskRecordMapper recordMapper, ProcessEngine processEngine,
                           GraphParser graphParser) {
        this.defMapper = defMapper;
        this.instanceMapper = instanceMapper;
        this.taskMapper = taskMapper;
        this.recordMapper = recordMapper;
        this.processEngine = processEngine;
        this.graphParser = graphParser;
    }

    @Transactional(rollbackFor = Exception.class)
    public InstanceVO start(InstanceStartRequest req) {
        // 锁定 ENABLED 最大 version
        List<WfProcessDefinition> defs = defMapper.selectList(new LambdaQueryWrapper<WfProcessDefinition>()
                .eq(WfProcessDefinition::getCode, req.getDefCode())
                .eq(WfProcessDefinition::getStatus, DefinitionStatus.ENABLED)
                .orderByDesc(WfProcessDefinition::getVersion));
        if (defs.isEmpty()) throw new BizException("WF_DEF_NOT_ENABLED", "没有启用的流程定义");
        WfProcessDefinition def = defs.get(0);

        // 取流程图的开始节点 id：不能硬编码，设计器生成的节点 id 是随机的
        FlowGraph graph = graphParser.parse(def.getGraphJson());
        String startNodeKey = graph.getNodes().stream()
                .filter(n -> n.getType() == NodeType.START)
                .findFirst()
                .orElseThrow(() -> new BizException("WF_GRAPH_INVALID", "流程图缺少开始节点"))
                .getId();

        String chosenJson = null;
        if (req.getChosenUserIds() != null && !req.getChosenUserIds().isEmpty()) {
            try { chosenJson = objectMapper.writeValueAsString(req.getChosenUserIds()); } catch (Exception ignored) {}
        }

        WfProcessInstance inst = new WfProcessInstance();
        inst.setDefId(def.getId());
        inst.setDefVersion(def.getVersion());
        inst.setTitle(req.getTitle());
        inst.setBusinessKey(req.getBusinessKey());
        inst.setFormJson(req.getFormJson());
        inst.setInitiatorId(req.getInitiatorId());
        inst.setCurrentNodeKey(startNodeKey);
        inst.setCurrentRound(1);
        inst.setChosenUserIds(chosenJson);
        inst.setStatus(InstanceStatus.RUNNING);
        inst.setStartTime(LocalDateTime.now());
        inst.setCreateTime(LocalDateTime.now());
        inst.setUpdateTime(LocalDateTime.now());
        instanceMapper.insert(inst);

        // 写 SUBMIT 流水
        WfTaskRecord rec = new WfTaskRecord();
        rec.setInstanceId(inst.getId());
        rec.setTaskId(null);
        rec.setNodeKey(startNodeKey);
        rec.setNodeName("发起");
        rec.setOperatorId(req.getInitiatorId());
        rec.setAction(RecordAction.SUBMIT);
        rec.setComment("发起流程");
        rec.setRound(1);
        rec.setCreateTime(LocalDateTime.now());
        recordMapper.insert(rec);

        // 回调引擎推进
        processEngine.onInstanceCreated(inst.getId());

        //  reload 最新状态
        inst = instanceMapper.selectById(inst.getId());
        return toVO(inst);
    }

    public InstanceVO getById(Long id) {
        WfProcessInstance inst = instanceMapper.selectById(id);
        if (inst == null) throw new BizException("WF_INSTANCE_NOT_FOUND", "实例不存在");
        return toVO(inst);
    }

    @Transactional(rollbackFor = Exception.class)
    public InstanceVO cancel(Long id, Long operatorId) {
        processEngine.cancelInstance(id, operatorId);
        WfProcessInstance inst = instanceMapper.selectById(id);
        return toVO(inst);
    }

    public List<TaskRecordVO> listRecords(Long instanceId) {
        List<WfTaskRecord> list = recordMapper.selectList(new LambdaQueryWrapper<WfTaskRecord>()
                .eq(WfTaskRecord::getInstanceId, instanceId)
                .orderByAsc(WfTaskRecord::getCreateTime));
        return list.stream().map(this::toVO).collect(Collectors.toList());
    }

    private InstanceVO toVO(WfProcessInstance i) {
        InstanceVO vo = new InstanceVO();
        vo.setInstanceId(i.getId());
        vo.setDefId(i.getDefId());
        vo.setDefVersion(i.getDefVersion());
        vo.setTitle(i.getTitle());
        vo.setBusinessKey(i.getBusinessKey());
        vo.setInitiatorId(i.getInitiatorId());
        vo.setCurrentNodeKey(i.getCurrentNodeKey());
        vo.setCurrentRound(i.getCurrentRound());
        vo.setStatus(i.getStatus().name());
        vo.setStartTime(i.getStartTime() != null ? i.getStartTime().format(FMT) : null);
        vo.setEndTime(i.getEndTime() != null ? i.getEndTime().format(FMT) : null);
        return vo;
    }

    private TaskRecordVO toVO(WfTaskRecord r) {
        TaskRecordVO vo = new TaskRecordVO();
        vo.setId(r.getId());
        vo.setInstanceId(r.getInstanceId());
        vo.setTaskId(r.getTaskId());
        vo.setNodeKey(r.getNodeKey());
        vo.setNodeName(r.getNodeName());
        vo.setOperatorId(r.getOperatorId());
        vo.setAction(r.getAction() != null ? r.getAction().name() : null);
        vo.setComment(r.getComment());
        vo.setRound(r.getRound());
        vo.setCreateTime(r.getCreateTime());
        return vo;
    }
}
