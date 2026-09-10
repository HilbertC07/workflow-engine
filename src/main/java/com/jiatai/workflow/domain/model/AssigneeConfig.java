package com.jiatai.workflow.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssigneeConfig {
    private List<Long> userIds;
    private List<String> roleCodes;
}
