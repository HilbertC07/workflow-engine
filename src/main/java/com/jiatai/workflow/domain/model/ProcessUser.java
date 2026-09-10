package com.jiatai.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 用户视图模型（第一版由 MockIdentityServiceImpl 提供，接真实系统后换成组织接口返回值）
 */
@Data
@AllArgsConstructor
public class ProcessUser {
    private Long id;
    private String name;
    /** 角色名称，仅前端展示用，不参与流程逻辑 */
    private String role;
}
