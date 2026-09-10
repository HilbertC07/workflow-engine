package com.jiatai.workflow.engine;

import com.jiatai.workflow.mapper.WfNodeDefinitionMapper;
import com.jiatai.workflow.mapper.WfProcessDefinitionMapper;
import com.jiatai.workflow.mapper.WfProcessInstanceMapper;
import com.jiatai.workflow.mapper.WfTaskMapper;
import com.jiatai.workflow.mapper.WfTaskRecordMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 引擎类测试的公共基类。
 *
 * <p><b>为什么需要它：</b>测试用的 H2 是 `jdbc:h2:mem:test` 单例库，
 * `spring.sql.init` 只负责建表、不会清数据，多个测试类共用同一个库时会互相污染 ——
 * 典型症状是「期望 1 实际 5」，数字恰好等于前面用例累计插入的行数。</p>
 *
 * <p>另外 H2 版 schema 没有 MySQL 版 `wf_task` 上的 `uk_task` 唯一索引，
 * 无法靠数据库约束兜底，因此必须在每个用例前显式清表。</p>
 *
 * <p>清理顺序按「先子表后父表」：task_record → task → instance → node_definition → process_definition，
 * 虽然这些表之间没有建外键，但保持顺序便于将来加约束后不炸。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class BaseEngineTest {

    @Autowired protected WfProcessDefinitionMapper definitionMapper;
    @Autowired protected WfNodeDefinitionMapper nodeDefinitionMapper;
    @Autowired protected WfProcessInstanceMapper instanceMapper;
    @Autowired protected WfTaskMapper taskMapper;
    @Autowired protected WfTaskRecordMapper recordMapper;

    @BeforeEach
    void cleanDatabase() {
        recordMapper.delete(null);
        taskMapper.delete(null);
        instanceMapper.delete(null);
        nodeDefinitionMapper.delete(null);
        definitionMapper.delete(null);
    }
}
