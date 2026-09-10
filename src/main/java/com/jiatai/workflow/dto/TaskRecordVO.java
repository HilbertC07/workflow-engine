package com.jiatai.workflow.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TaskRecordVO {
    private Long id;
    private Long instanceId;
    private Long taskId;
    private String nodeKey;
    private String nodeName;
    private Long operatorId;
    private String action;
    private String comment;
    private Integer round;
    private LocalDateTime createTime;
}
