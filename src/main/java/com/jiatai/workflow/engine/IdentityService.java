package com.jiatai.workflow.engine;

import com.jiatai.workflow.domain.model.ProcessRole;
import com.jiatai.workflow.domain.model.ProcessUser;
import java.util.List;

/** 组织架构接口，第一版用 Mock 实现，后续接真实系统只换实现类 */
public interface IdentityService {
    List<Long> listUsersByRoleCodes(List<String> roleCodes);

    Long getDeptLeader(Long userId);

    /** 全部可选用户，供设计器属性面板与前端用户切换下拉使用 */
    List<ProcessUser> listAllUsers();

    /** 全部可选角色，供设计器属性面板「指定角色」下拉使用 */
    List<ProcessRole> listAllRoles();
}
