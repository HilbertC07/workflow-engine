package com.jiatai.workflow.controller;

import com.jiatai.workflow.common.R;
import com.jiatai.workflow.dto.DefinitionSaveRequest;
import com.jiatai.workflow.dto.DefinitionVO;
import com.jiatai.workflow.service.DefinitionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workflow/definition")
public class DefinitionController {

    private final DefinitionService definitionService;

    public DefinitionController(DefinitionService definitionService) {
        this.definitionService = definitionService;
    }

    @PostMapping("/save")
    public R<DefinitionVO> save(@Valid @RequestBody DefinitionSaveRequest req) {
        return R.ok(definitionService.save(req));
    }

    @GetMapping("/{code}/latest-enabled")
    public R<DefinitionVO> latestEnabled(@PathVariable String code) {
        return R.ok(definitionService.latestEnabled(code));
    }
}
