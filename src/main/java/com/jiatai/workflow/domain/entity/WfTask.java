package com.jiatai.workflow.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.jiatai.workflow.domain.enums.NodeType;
import com.jiatai.workflow.domain.enums.TaskStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wf_task")
public class WfTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long instanceId;
    private String nodeKey;
    private String nodeName;
    private NodeType nodeType;
    private Long assigneeId;
    private TaskStatus status;
    private String action;
    private String comment;
    /** 第几轮，从 1 开始，驳回重走时用新 round */
    private Integer round;
    private LocalDateTime createTime;
    private LocalDateTime finishTime;
}
