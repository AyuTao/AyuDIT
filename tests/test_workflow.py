"""工作流程测试模块。"""

import asyncio
import pytest

from ayu_dit.core.workflow_controller import WorkflowController
from ayu_dit.core.base_step import WorkflowStep, WorkflowContext, StepResult


class MockStep(WorkflowStep):
    """模拟工作流程步骤。"""
    
    def __init__(self, name: str, should_succeed: bool = True, duration: float = 0.1):
        """初始化模拟步骤。
        
        Args:
            name: 步骤名称
            should_succeed: 是否应该成功
            duration: 模拟执行时间
        """
        super().__init__(name)
        self.should_succeed = should_succeed
        self.duration = duration
    
    async def execute(self, context: WorkflowContext) -> StepResult:
        """执行模拟步骤。"""
        # 模拟执行时间
        await asyncio.sleep(self.duration)
        
        if self.should_succeed:
            return StepResult(
                success=True,
                message=f"步骤 {self.name} 执行成功"
            )
        else:
            return StepResult(
                success=False,
                message=f"步骤 {self.name} 执行失败"
            )


class TestWorkflowController:
    """工作流程控制器测试类。"""
    
    @pytest.mark.asyncio
    async def test_empty_workflow(self):
        """测试空工作流程。"""
        config = {'test': True}
        controller = WorkflowController(config)
        
        result = await controller.execute_workflow("/test/source")
        
        assert result['success'] is True
        assert result['total_steps'] == 0
        assert result['successful_steps'] == 0
        assert result['failed_steps'] == 0
    
    @pytest.mark.asyncio
    async def test_successful_workflow(self):
        """测试成功的工作流程。"""
        config = {'test': True}
        controller = WorkflowController(config)
        
        # 添加成功的步骤
        controller.add_step(MockStep("步骤1", True))
        controller.add_step(MockStep("步骤2", True))
        controller.add_step(MockStep("步骤3", True))
        
        result = await controller.execute_workflow("/test/source")
        
        assert result['success'] is True
        assert result['total_steps'] == 3
        assert result['successful_steps'] == 3
        assert result['failed_steps'] == 0
        assert len(result['step_results']) == 3
    
    @pytest.mark.asyncio
    async def test_failed_workflow(self):
        """测试包含失败步骤的工作流程。"""
        config = {'test': True}
        controller = WorkflowController(config)
        
        # 添加成功和失败的步骤
        controller.add_step(MockStep("步骤1", True))
        controller.add_step(MockStep("步骤2", False))  # 失败步骤
        controller.add_step(MockStep("步骤3", True))
        
        result = await controller.execute_workflow("/test/source")
        
        assert result['success'] is False
        assert result['total_steps'] == 3
        assert result['successful_steps'] == 2
        assert result['failed_steps'] == 1
    
    def test_add_steps(self):
        """测试添加步骤。"""
        config = {'test': True}
        controller = WorkflowController(config)
        
        steps = [
            MockStep("步骤1"),
            MockStep("步骤2"),
            MockStep("步骤3")
        ]
        
        controller.add_steps(steps)
        
        assert len(controller.steps) == 3
        assert controller.steps[0].name == "步骤1"
        assert controller.steps[1].name == "步骤2"
        assert controller.steps[2].name == "步骤3"
    
    def test_progress_tracking(self):
        """测试进度跟踪。"""
        config = {'test': True}
        controller = WorkflowController(config)
        
        controller.add_step(MockStep("步骤1"))
        controller.add_step(MockStep("步骤2"))
        
        progress = controller.get_progress()
        
        assert progress['total_steps'] == 2
        assert progress['completed_steps'] == 0
        assert progress['failed_steps'] == 0
        assert progress['current_step_index'] == 0
        assert progress['is_running'] is False
        assert progress['is_paused'] is False
        assert progress['progress_percentage'] == 0.0