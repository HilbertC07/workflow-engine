package com.jiatai.workflow.domain.enums;

/**
 * 流转流水动作。
 * operator_id 口径：SUBMIT/CANCEL=发起人；APPROVE/REJECT=该审批人；CC=被抄送人；FINISH=最后一位审批人（取不到填发起人）。
 */
public enum RecordAction {
    SUBMIT, APPROVE, REJECT, CC, CANCEL, FINISH
}
