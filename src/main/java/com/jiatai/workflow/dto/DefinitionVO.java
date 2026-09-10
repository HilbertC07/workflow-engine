package com.jiatai.workflow.dto;

import lombok.Data;

@Data
public class DefinitionVO {
    private Long definitionId;
    private String code;
    private String name;
    private Integer version;
    private String status;
    private String graphJson;
}
