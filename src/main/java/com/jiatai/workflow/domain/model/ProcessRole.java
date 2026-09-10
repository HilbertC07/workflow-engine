package com.jiatai.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 角色视图模型（第一版由 MockIdentityServiceImpl 提供）
 * code 与 AssigneeConfig.roleCodes 中的取值一致，name 仅前端展示用
 */
@Data
@AllArgsConstructor
public class ProcessRole {
    private String code;
    private String name;
}
