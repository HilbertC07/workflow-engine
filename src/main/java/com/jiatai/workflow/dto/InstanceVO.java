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
    /** 撤回按钮态（仅前端提示用，权威校验在引擎撤回逻辑）：RUNNING 且无任何已处理审批任务 */
    private Boolean canWithdraw;
}
