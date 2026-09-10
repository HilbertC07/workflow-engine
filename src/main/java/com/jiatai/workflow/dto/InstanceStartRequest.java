package com.jiatai.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InstanceStartRequest {
    @NotBlank(message = "流程编码不能为空")
    private String defCode;
    @NotNull(message = "发起人不能为空")
    private Long initiatorId;
    @NotBlank(message = "标题不能为空")
    private String title;
    private String businessKey;
    /** 表单JSON，可选 */
    private String formJson;
    /** INITIATOR_CHOOSE 节点的自选审批人，key=nodeKey，value=用户id列表 */
    private java.util.Map<String, java.util.List<Long>> chosenUserIds;
}
