package com.jiatai.workflow.controller;

import com.jiatai.workflow.common.R;
import com.jiatai.workflow.dto.DefinitionSaveRequest;
import com.jiatai.workflow.dto.DefinitionVO;
import com.jiatai.workflow.service.DefinitionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /** 所有启用中的流程定义（每 code 最新版本），发起申请页下拉用 */
    @GetMapping("/list")
    public R<List<DefinitionVO>> list() {
        return R.ok(definitionService.listEnabled());
    }

    @GetMapping("/{code}/latest-enabled")
    public R<DefinitionVO> latestEnabled(@PathVariable String code) {
        return R.ok(definitionService.latestEnabled(code));
    }
}
