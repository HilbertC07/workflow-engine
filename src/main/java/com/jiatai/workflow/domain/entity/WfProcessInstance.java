package com.jiatai.workflow.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.jiatai.workflow.domain.enums.InstanceStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wf_process_instance")
public class WfProcessInstance {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 发起时永久锁定的定义行 */
    private Long defId;
    private Integer defVersion;
    private String title;
    private String businessKey;
    private String formJson;
    private Long initiatorId;
    private String currentNodeKey;
    /** 当前第几轮，从 1 开始；驳回重走时 +1 */
    private Integer currentRound;
    /** 发起人自选审批人，JSON 形如 {"approve_1":[1002,1004]} */
    private String chosenUserIds;
    private InstanceStatus status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
