package com.jiatai.workflow.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.jiatai.workflow.domain.enums.NodeType;
import lombok.Data;

import java.util.List;

/** 流程图 JSON 顶层模型 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FlowGraph {
    private List<FlowNode> nodes;
    private List<FlowEdge> edges;

    public FlowNode node(String id) {
        return nodes.stream().filter(n -> n.getId().equals(id)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("图中不存在节点: " + id));
    }
}
