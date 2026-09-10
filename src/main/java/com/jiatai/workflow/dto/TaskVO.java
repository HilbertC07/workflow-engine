package com.jiatai.workflow.dto;

import lombok.Data;

import java.util.List;

@Data
public class TaskVO {
    private Long taskId;
    private Long instanceId;
    private String instanceTitle;
    private String nodeKey;
    private String nodeName;
    private Long assigneeId;
    private String status;
    private Integer round;
    private String createTime;
}
