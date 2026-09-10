package com.jiatai.workflow.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** 第一版线性流，condition 保留但恒为 null */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FlowEdge {
    private String source;
    private String target;
    private String condition;
}
