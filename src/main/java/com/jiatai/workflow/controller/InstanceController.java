package com.jiatai.workflow.controller;

import com.jiatai.workflow.common.R;
import com.jiatai.workflow.dto.InstanceStartRequest;
import com.jiatai.workflow.dto.InstanceVO;
import com.jiatai.workflow.dto.OperatorRequest;
import com.jiatai.workflow.dto.TaskRecordVO;
import com.jiatai.workflow.service.InstanceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workflow/instance")
public class InstanceController {

    private final InstanceService instanceService;

    public InstanceController(InstanceService instanceService) {
        this.instanceService = instanceService;
    }

    @PostMapping("/start")
    public R<InstanceVO> start(@Valid @RequestBody InstanceStartRequest req) {
        return R.ok(instanceService.start(req));
    }

    @GetMapping("/{id}")
    public R<InstanceVO> get(@PathVariable Long id) {
        return R.ok(instanceService.getById(id));
    }

    @PostMapping("/{id}/cancel")
    public R<InstanceVO> cancel(@PathVariable Long id, @Valid @RequestBody OperatorRequest req) {
        return R.ok(instanceService.cancel(id, req.getOperatorId()));
    }

    @GetMapping("/{id}/records")
    public R<List<TaskRecordVO>> records(@PathVariable Long id) {
        return R.ok(instanceService.listRecords(id));
    }
}
