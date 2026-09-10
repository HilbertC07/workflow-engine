package com.jiatai.workflow.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.jiatai.workflow.domain.enums.RecordAction;
import lombok.Data;

import java.time.LocalDateTime;

/** 流转流水，只追加不修改，用于时间线展示 */
@Data
@TableName("wf_task_record")
public class WfTaskRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long instanceId;
    private Long taskId;
    private String nodeKey;
    private String nodeName;
    private Long operatorId;
    private RecordAction action;
    private String comment;
    private Integer round;
    private LocalDateTime createTime;
}
