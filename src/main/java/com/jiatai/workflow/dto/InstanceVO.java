package com.jiatai.workflow.dto;

import lombok.Data;

@Data
public class InstanceVO {
    private Long instanceId;
    private Long defId;
    private Integer defVersion;
    private String title;
    private String businessKey;
    private Long initiatorId;
    private String currentNodeKey;
    private Integer currentRound;
    private String status;
    private String startTime;
    private String endTime;
}
