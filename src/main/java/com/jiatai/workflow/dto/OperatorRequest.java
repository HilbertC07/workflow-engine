package com.jiatai.workflow.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 同意 / 驳回 / 撤回通用操作入参 */
@Data
public class OperatorRequest {
    @NotNull(message = "操作人不能为空")
    private Long operatorId;
    private String comment;
}
