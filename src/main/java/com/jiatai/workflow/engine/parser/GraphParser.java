package com.jiatai.workflow.engine.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jiatai.workflow.common.BizException;
import com.jiatai.workflow.domain.enums.NodeType;
import com.jiatai.workflow.domain.model.FlowEdge;
import com.jiatai.workflow.domain.model.FlowGraph;
import com.jiatai.workflow.domain.model.FlowNode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 流程图 JSON 解析 + 保存前图校验 */
@Component
public class GraphParser {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public FlowGraph parse(String graphJson) {
        if (graphJson == null || graphJson.isBlank()) {
            throw new BizException("WF_GRAPH_EMPTY", "流程图JSON不能为空");
        }
        FlowGraph graph;
        try {
            graph = objectMapper.readValue(graphJson, FlowGraph.class);
        } catch (Exception e) {
            throw new BizException("WF_GRAPH_INVALID", "流程图JSON格式不合法");
        }
        validate(graph);
        return graph;
    }

    public void validate(FlowGraph graph) {
        if (graph.getNodes() == null || graph.getNodes().isEmpty()) {
            throw new BizException("WF_GRAPH_INVALID", "流程图必须包含节点");
        }
        Map<String, FlowNode> nodeMap = graph.getNodes().stream()
                .collect(Collectors.toMap(FlowNode::getId, Function.identity()));
        if (nodeMap.size() != graph.getNodes().size()) {
            throw new BizException("WF_GRAPH_INVALID", "节点id不允许重复");
        }
        List<FlowEdge> edges = graph.getEdges() == null ? List.of() : graph.getEdges();
        long startCount = graph.getNodes().stream().filter(n -> n.getType() == NodeType.START).count();
        long endCount = graph.getNodes().stream().filter(n -> n.getType() == NodeType.END).count();
        long approvalCount = graph.getNodes().stream().filter(n -> n.getType() == NodeType.APPROVAL).count();
        if (startCount != 1) {
            throw new BizException("WF_GRAPH_INVALID", "流程图必须有且只有一个开始节点");
        }
        if (endCount < 1) {
            throw new BizException("WF_GRAPH_INVALID", "流程图至少包含一个结束节点");
        }
        if (approvalCount < 1) {
            throw new BizException("WF_GRAPH_INVALID", "流程图至少包含一个审批节点");
        }
        for (FlowNode node : graph.getNodes()) {
            List<FlowEdge> outs = edges.stream().filter(e -> e.getSource().equals(node.getId())).toList();
            List<FlowEdge> ins = edges.stream().filter(e -> e.getTarget().equals(node.getId())).toList();
            if (outs.size() > 1 || ins.size() > 1) {
                throw new BizException("WF_GRAPH_INVALID", "第一版仅支持线性顺序流，节点" + node.getId() + "的连线必须进出各最多一条");
            }
            if (node.getType() == NodeType.START && !ins.isEmpty()) {
                throw new BizException("WF_GRAPH_INVALID", "开始节点不允许有入线");
            }
            if (node.getType() == NodeType.END && !outs.isEmpty()) {
                throw new BizException("WF_GRAPH_INVALID", "结束节点不允许有出线");
            }
            if (node.getType() != NodeType.START && ins.isEmpty()) {
                throw new BizException("WF_GRAPH_INVALID", "节点" + node.getId() + "是孤立节点");
            }
            if (node.getType() != NodeType.END && outs.isEmpty()) {
                throw new BizException("WF_GRAPH_INVALID", "节点" + node.getId() + "是孤立节点");
            }
            for (FlowEdge edge : outs) {
                if (!nodeMap.containsKey(edge.getTarget())) {
                    throw new BizException("WF_GRAPH_INVALID", "连线指向不存在的节点: " + edge.getTarget());
                }
            }
        }
        // 环检测：从 START 沿唯一出线走，步数超过节点数说明有环或走不到 END
        FlowNode current = graph.getNodes().stream().filter(n -> n.getType() == NodeType.START).findFirst().orElseThrow();
        int steps = 0;
        while (current.getType() != NodeType.END) {
            steps++;
            if (steps > graph.getNodes().size()) {
                throw new BizException("WF_GRAPH_INVALID", "流程图不允许存在环");
            }
            final String fromKey = current.getId();
            String next = edges.stream().filter(e -> e.getSource().equals(fromKey))
                    .findFirst().orElseThrow().getTarget();
            current = graph.node(next);
        }
    }

    /** 沿唯一出线取下一节点id */
    public String nextNodeKey(FlowGraph graph, String currentNodeKey) {
        return graph.getEdges().stream()
                .filter(e -> e.getSource().equals(currentNodeKey))
                .findFirst()
                .orElseThrow(() -> new BizException("WF_GRAPH_INVALID", "节点" + currentNodeKey + "没有出线"))
                .getTarget();
    }
}
