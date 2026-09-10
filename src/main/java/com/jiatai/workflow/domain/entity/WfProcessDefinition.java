package com.jiatai.workflow.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.jiatai.workflow.domain.enums.DefinitionStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wf_process_definition")
public class WfProcessDefinition {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String code;
    private String name;
    private Integer version;
    /** 流程图JSON，唯一真相，LONGTEXT 对应 String */
    private String graphJson;
    private DefinitionStatus status;
    private String description;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
