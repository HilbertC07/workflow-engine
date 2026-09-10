package com.jiatai.workflow.engine;

import com.jiatai.workflow.domain.model.ProcessRole;
import com.jiatai.workflow.domain.model.ProcessUser;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Mock 用户：1001 张三（员工）、1002 李四（部门主管）、1003 王五（人事）、1004 赵六（总经理）、1005 钱七（员工）
 */
@Service
public class MockIdentityServiceImpl implements IdentityService {

    private static final List<ProcessUser> ALL_USERS = List.of(
            new ProcessUser(1001L, "张三", "员工"),
            new ProcessUser(1002L, "李四", "部门主管"),
            new ProcessUser(1003L, "王五", "人事"),
            new ProcessUser(1004L, "赵六", "总经理"),
            new ProcessUser(1005L, "钱七", "员工")
    );

    private static final List<ProcessRole> ALL_ROLES = List.of(
            new ProcessRole("DEPT_MANAGER", "部门主管"),
            new ProcessRole("GENERAL_MANAGER", "总经理")
    );

    private static final Map<String, List<Long>> ROLE_USERS = Map.of(
            "DEPT_MANAGER", List.of(1002L),
            "GENERAL_MANAGER", List.of(1004L)
    );

    @Override
    public List<ProcessUser> listAllUsers() {
        return ALL_USERS;
    }

    @Override
    public List<ProcessRole> listAllRoles() {
        return ALL_ROLES;
    }

    @Override
    public List<Long> listUsersByRoleCodes(List<String> roleCodes) {
        return roleCodes.stream()
                .filter(ROLE_USERS::containsKey)
                .flatMap(code -> ROLE_USERS.get(code).stream())
                .distinct()
                .toList();
    }

    @Override
    public Long getDeptLeader(Long userId) {
        // Mock：张三/钱七的部门主管是李四
        return (userId == 1001L || userId == 1005L) ? 1002L : null;
    }
}
