package com.jiatai.workflow.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jiatai.workflow.common.BizException;
import com.jiatai.workflow.domain.enums.DefinitionStatus;
import com.jiatai.workflow.domain.entity.WfNodeDefinition;
import com.jiatai.workflow.domain.entity.WfProcessDefinition;
import com.jiatai.workflow.domain.model.FlowGraph;
import com.jiatai.workflow.domain.model.FlowNode;
import com.jiatai.workflow.dto.DefinitionSaveRequest;
import com.jiatai.workflow.dto.DefinitionVO;
import com.jiatai.workflow.engine.parser.GraphParser;
import com.jiatai.workflow.mapper.WfNodeDefinitionMapper;
import com.jiatai.workflow.mapper.WfProcessDefinitionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DefinitionService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WfProcessDefinitionMapper defMapper;
    private final WfNodeDefinitionMapper nodeDefMapper;
    private final GraphParser graphParser;

    public DefinitionService(WfProcessDefinitionMapper defMapper, WfNodeDefinitionMapper nodeDefMapper, GraphParser graphParser) {
        this.defMapper = defMapper;
        this.nodeDefMapper = nodeDefMapper;
        this.graphParser = graphParser;
    }

    /**
     * 保存流程定义：新增一行 version+1，同 code 的旧 ENABLED 置 DISABLED，同步写节点表
     */
    @Transactional(rollbackFor = Exception.class)
    public DefinitionVO save(DefinitionSaveRequest req) {
        // 解析并校验图
        FlowGraph graph = graphParser.parse(req.getGraphJson());

        // 取该 code 当前最大 version
        Integer maxVer = defMapper.selectList(new LambdaQueryWrapper<WfProcessDefinition>()
                        .eq(WfProcessDefinition::getCode, req.getCode())
                        .select(WfProcessDefinition::getVersion))
                .stream().mapToInt(WfProcessDefinition::getVersion).max().orElse(0);

        WfProcessDefinition def = new WfProcessDefinition();
        def.setCode(req.getCode());
        def.setName(req.getName());
        def.setDescription(req.getDescription());
        def.setVersion(maxVer + 1);
        def.setGraphJson(req.getGraphJson());
        def.setStatus(DefinitionStatus.ENABLED);
        def.setCreateTime(LocalDateTime.now());
        def.setUpdateTime(LocalDateTime.now());
        defMapper.insert(def);

        // 同 code 其他 ENABLED 置 DISABLED
        defMapper.update(null, new LambdaUpdateWrapper<WfProcessDefinition>()
                .eq(WfProcessDefinition::getCode, req.getCode())
                .ne(WfProcessDefinition::getId, def.getId())
                .eq(WfProcessDefinition::getStatus, DefinitionStatus.ENABLED)
                .set(WfProcessDefinition::getStatus, DefinitionStatus.DISABLED));

        // 同步写节点定义（扁平化）
        int sortOrder = 0;
        for (FlowNode node : graph.getNodes()) {
            WfNodeDefinition nd = new WfNodeDefinition();
            nd.setDefId(def.getId());
            nd.setNodeKey(node.getId());
            nd.setNodeType(node.getType());
            nd.setNodeName(node.getName());
            if (node.getProps() != null) {
                nd.setAssigneeType(node.getProps().getAssigneeType());
                nd.setMultiMode(node.getProps().getMultiMode());
                nd.setAllowReject(node.getProps().getAllowReject());
                nd.setAllowTransfer(node.getProps().getAllowTransfer());
                nd.setRejectStrategy(node.getProps().getRejectStrategy());
                try {
                    if (node.getProps().getAssigneeConfig() != null) {
                        nd.setAssigneeConfig(objectMapper.writeValueAsString(node.getProps().getAssigneeConfig()));
                    }
                } catch (Exception ignored) {}
            }
            nd.setSortOrder(sortOrder++);
            nd.setCreateTime(LocalDateTime.now());
            nd.setUpdateTime(LocalDateTime.now());
            nodeDefMapper.insert(nd);
        }

        DefinitionVO vo = new DefinitionVO();
        vo.setDefinitionId(def.getId());
        vo.setCode(def.getCode());
        vo.setName(def.getName());
        vo.setVersion(def.getVersion());
        vo.setStatus(def.getStatus().name());
        vo.setGraphJson(def.getGraphJson());
        return vo;
    }

    /**
     * 所有启用中的流程定义（每个 code 只取最新 version），供发起申请页下拉使用
     */
    public List<DefinitionVO> listEnabled() {
        return defMapper.selectEnabledLatest().stream()
                .map(def -> {
                    DefinitionVO vo = new DefinitionVO();
                    vo.setDefinitionId(def.getId());
                    vo.setCode(def.getCode());
                    vo.setName(def.getName());
                    vo.setVersion(def.getVersion());
                    vo.setStatus(def.getStatus().name());
                    vo.setGraphJson(def.getGraphJson());
                    return vo;
                })
                .collect(java.util.stream.Collectors.toList());
    }

    public DefinitionVO latestEnabled(String code) {
        List<WfProcessDefinition> list = defMapper.selectList(new LambdaQueryWrapper<WfProcessDefinition>()
                .eq(WfProcessDefinition::getCode, code)
                .eq(WfProcessDefinition::getStatus, DefinitionStatus.ENABLED)
                .orderByDesc(WfProcessDefinition::getVersion));
        if (list.isEmpty()) throw new BizException("WF_DEF_NOT_FOUND", "未找到启用的流程定义");
        WfProcessDefinition def = list.get(0);
        DefinitionVO vo = new DefinitionVO();
        vo.setDefinitionId(def.getId());
        vo.setCode(def.getCode());
        vo.setName(def.getName());
        vo.setVersion(def.getVersion());
        vo.setStatus(def.getStatus().name());
        vo.setGraphJson(def.getGraphJson());
        return vo;
    }
}
