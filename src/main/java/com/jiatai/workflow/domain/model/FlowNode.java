package com.jiatai.workflow.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.jiatai.workflow.domain.enums.NodeType;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FlowNode {
    private String id;
    private NodeType type;
    private String name;
    private NodeProps props;

    /**
     * 画布坐标，仅供设计器回显用。
     * 不参与任何流程语义与图校验，GraphParser / GraphValidator 必须忽略这两个字段。
     */
    private Double x;
    private Double y;
}
