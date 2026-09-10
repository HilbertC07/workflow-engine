package com.jiatai.workflow.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.jiatai.workflow.domain.enums.AssigneeType;
import com.jiatai.workflow.domain.enums.MultiMode;
import com.jiatai.workflow.domain.enums.RejectStrategy;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NodeProps {
    private AssigneeType assigneeType;
    private AssigneeConfig assigneeConfig;
    private MultiMode multiMode;
    private Boolean allowReject;
    private RejectStrategy rejectStrategy;
    private Boolean allowTransfer;
    /** CC 节点直接读 props.userIds */
    private List<Long> userIds;
}
