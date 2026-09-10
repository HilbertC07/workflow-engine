package com.jiatai.workflow.controller;

import com.jiatai.workflow.common.R;
import com.jiatai.workflow.dto.InstanceVO;
import com.jiatai.workflow.dto.OperatorRequest;
import com.jiatai.workflow.dto.TaskVO;
import com.jiatai.workflow.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workflow/task")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("/todo")
    public R<List<TaskVO>> todo(@RequestParam Long assigneeId) {
        return R.ok(taskService.listTodo(assigneeId));
    }

    @PostMapping("/{id}/approve")
    public R<InstanceVO> approve(@PathVariable Long id, @Valid @RequestBody OperatorRequest req) {
        return R.ok(taskService.approve(id, req.getOperatorId(), req.getComment()));
    }

    @PostMapping("/{id}/reject")
    public R<InstanceVO> reject(@PathVariable Long id, @Valid @RequestBody OperatorRequest req) {
        return R.ok(taskService.reject(id, req.getOperatorId(), req.getComment()));
    }
}
