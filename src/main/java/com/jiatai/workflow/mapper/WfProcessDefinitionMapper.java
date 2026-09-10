package com.jiatai.workflow.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jiatai.workflow.domain.entity.WfProcessDefinition;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface WfProcessDefinitionMapper extends BaseMapper<WfProcessDefinition> {

    /**
     * SQL 层面取每个 code 的最大 version 且状态为 ENABLED 的定义（发起申请页下拉用）。
     * 原生 SQL 不走 @TableLogic，deleted 条件需显式带上。
     */
    @Select("SELECT d.* FROM wf_process_definition d "
            + "INNER JOIN (SELECT code, MAX(version) AS max_version FROM wf_process_definition "
            + "            WHERE status = 'ENABLED' AND deleted = 0 GROUP BY code) t "
            + "ON d.code = t.code AND d.version = t.max_version "
            + "WHERE d.status = 'ENABLED' AND d.deleted = 0 "
            + "ORDER BY d.code")
    List<WfProcessDefinition> selectEnabledLatest();
}
