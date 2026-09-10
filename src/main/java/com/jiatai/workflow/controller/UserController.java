package com.jiatai.workflow.controller;

import com.jiatai.workflow.common.R;
import com.jiatai.workflow.domain.model.ProcessRole;
import com.jiatai.workflow.domain.model.ProcessUser;
import com.jiatai.workflow.engine.IdentityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户接口，供前端设计器属性面板选审批人、以及顶部用户切换下拉使用。
 * 第一版来自 MockIdentityServiceImpl，接真实组织后仅替换实现类。
 */
@RestController
@RequestMapping("/api/workflow")
public class UserController {

    private final IdentityService identityService;

    public UserController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @GetMapping("/users")
    public R<List<ProcessUser>> listUsers() {
        return R.ok(identityService.listAllUsers());
    }

    /** 角色列表，供设计器属性面板「指定角色」下拉使用，code 与 AssigneeConfig.roleCodes 一致 */
    @GetMapping("/roles")
    public R<List<ProcessRole>> listRoles() {
        return R.ok(identityService.listAllRoles());
    }
}
