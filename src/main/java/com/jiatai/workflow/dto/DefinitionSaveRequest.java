package com.jiatai.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DefinitionSaveRequest {
    @NotBlank(message = "流程编码不能为空")
    private String code;
    @NotBlank(message = "流程名称不能为空")
    private String name;
    private String description;
    /** 完整流程图JSON（规则十一格式） */
    @NotBlank(message = "流程图JSON不能为空")
    private String graphJson;
}
