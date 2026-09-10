package com.jiatai.workflow.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.jiatai.workflow.domain.enums.AssigneeType;
import com.jiatai.workflow.domain.enums.MultiMode;
import com.jiatai.workflow.domain.enums.NodeType;
import com.jiatai.workflow.domain.enums.RejectStrategy;
import lombok.Data;

import java.time.LocalDateTime;

/** graph_json 的冗余扁平化，供引擎执行时快速查询 */
@Data
@TableName("wf_node_definition")
public class WfNodeDefinition {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long defId;
    private String nodeKey;
    private NodeType nodeType;
    private String nodeName;
    private AssigneeType assigneeType;
    /** JSON 字符串：APPROVAL 存 assigneeConfig，CC 存 {"userIds":[...]} */
    private String assigneeConfig;
    private MultiMode multiMode;
    private RejectStrategy rejectStrategy;
    private Boolean allowReject;
    private Boolean allowTransfer;
    private Integer sortOrder;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
