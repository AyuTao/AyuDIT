"""工作流程控制器模块。

负责协调和执行整个工作流程的各个步骤。
"""

import asyncio
import time
from typing import Dict, List, Optional, Any, Callable

from ayu_dit.core.base_step import WorkflowStep, WorkflowContext, StepStatus, StepResult
from ayu_dit.core.exceptions import WorkflowError, WorkflowStepError
from ayu_dit.utils.logger import get_logger


class WorkflowController:
    """工作流程控制器。
    
    负责管理和执行工作流程步骤。
    """
    
    def __init__(self, config: Dict[str, Any]):
        """初始化工作流程控制器。
        
        Args:
            config: 配置字典
        """
        self.config = config
        self.steps: List[WorkflowStep] = []
        self.current_step_index = 0
        self.logger = get_logger("workflow_controller")
        self.progress_callbacks: List[Callable] = []
        self.is_running = False
        self.is_paused = False
        self.should_stop = False
        
    def add_step(self, step: WorkflowStep):
        """添加工作流程步骤。
        
        Args:
            step: 要添加的步骤
        """
        self.steps.append(step)
        self.logger.debug(f"添加步骤: {step.name}")
    
    def add_steps(self, steps: List[WorkflowStep]):
        """批量添加工作流程步骤。
        
        Args:
            steps: 要添加的步骤列表
        """
        for step in steps:
            self.add_step(step)
    
    def add_progress_callback(self, callback: Callable):
        """添加进度回调函数。
        
        Args:
            callback: 回调函数
        """
        self.progress_callbacks.append(callback)
    
    async def execute_workflow(self, source_path: str) -> Dict[str, Any]:
        """执行完整工作流程。
        
        Args:
            source_path: 源媒体路径
            
        Returns:
            工作流程执行结果
            
        Raises:
            WorkflowError: 工作流程执行失败时抛出
        """
        if self.is_running:
            raise WorkflowError("工作流程已在运行中")
        
        self.is_running = True
        self.should_stop = False
        start_time = time.time()
        
        # 创建工作流程上下文
        context = WorkflowContext(
            source_path=source_path,
            config=self.config,
            data={}
        )
        
        self.logger.info(f"开始执行工作流程，源路径: {source_path}")
        
        try:
            # 执行所有步骤
            results = []
            for i, step in enumerate(self.steps):
                if self.should_stop:
                    self.logger.info("工作流程被用户停止")
                    break
                
                self.current_step_index = i
                
                # 等待暂停状态结束
                while self.is_paused and not self.should_stop:
                    await asyncio.sleep(0.1)
                
                if self.should_stop:
                    break
                
                # 执行步骤
                result = await self._execute_step(step, context)
                results.append(result)
                
                # 如果步骤失败且不可恢复，停止工作流程
                if not result.success and not self._is_recoverable_error(result.error):
                    self.logger.error(f"关键步骤失败，停止工作流程: {step.name}")
                    break
            
            # 计算总执行时间
            total_duration = time.time() - start_time
            
            # 生成工作流程结果
            workflow_result = self._generate_workflow_result(results, total_duration)
            
            self.logger.info(f"工作流程完成，总耗时: {total_duration:.2f}秒")
            return workflow_result
            
        except Exception as e:
            self.logger.error(f"工作流程执行异常: {e}")
            raise WorkflowError(f"工作流程执行失败: {str(e)}")
        finally:
            self.is_running = False
            self.is_paused = False
    
    async def _execute_step(self, step: WorkflowStep, context: WorkflowContext) -> StepResult:
        """执行单个工作流程步骤。
        
        Args:
            step: 要执行的步骤
            context: 工作流程上下文
            
        Returns:
            步骤执行结果
        """
        self.logger.info(f"开始执行步骤: {step.name}")
        step.status = StepStatus.RUNNING
        
        # 通知进度回调
        self._notify_progress_callbacks(step)
        
        start_time = time.time()
        
        try:
            # 验证前置条件
            if not step.validate_prerequisites(context):
                raise WorkflowStepError(
                    step.name,
                    "前置条件验证失败",
                    "PREREQUISITE_FAILED"
                )
            
            # 执行步骤
            result = await step.execute(context)
            
            # 更新步骤状态
            if result.success:
                step.status = StepStatus.COMPLETED
                self.logger.info(f"步骤执行成功: {step.name}")
            else:
                step.status = StepStatus.FAILED
                self.logger.error(f"步骤执行失败: {step.name} - {result.message}")
            
            # 设置执行时间
            result.duration = time.time() - start_time
            step.result = result
            
            return result
            
        except Exception as e:
            # 处理步骤执行异常
            step.status = StepStatus.FAILED
            error_result = StepResult(
                success=False,
                message=f"步骤执行异常: {str(e)}",
                error=e,
                duration=time.time() - start_time
            )
            step.result = error_result
            
            self.logger.error(f"步骤执行异常: {step.name} - {str(e)}")
            return error_result
        finally:
            # 通知进度回调
            self._notify_progress_callbacks(step)
    
    def pause_workflow(self):
        """暂停工作流程。"""
        if self.is_running:
            self.is_paused = True
            self.logger.info("工作流程已暂停")
    
    def resume_workflow(self):
        """恢复工作流程。"""
        if self.is_running and self.is_paused:
            self.is_paused = False
            self.logger.info("工作流程已恢复")
    
    def stop_workflow(self):
        """停止工作流程。"""
        self.should_stop = True
        self.is_paused = False
        self.logger.info("工作流程停止请求已发送")
    
    def get_progress(self) -> Dict[str, Any]:
        """获取工作流程进度信息。
        
        Returns:
            进度信息字典
        """
        total_steps = len(self.steps)
        completed_steps = sum(1 for step in self.steps if step.status == StepStatus.COMPLETED)
        failed_steps = sum(1 for step in self.steps if step.status == StepStatus.FAILED)
        
        current_step = None
        if 0 <= self.current_step_index < total_steps:
            current_step = self.steps[self.current_step_index].get_progress_info()
        
        return {
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "failed_steps": failed_steps,
            "current_step_index": self.current_step_index,
            "current_step": current_step,
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "progress_percentage": (completed_steps / total_steps * 100) if total_steps > 0 else 0
        }
    
    async def rollback_workflow(self, to_step_index: Optional[int] = None) -> Dict[str, Any]:
        """回滚工作流程到指定步骤。
        
        Args:
            to_step_index: 回滚到的步骤索引，如果为None则回滚所有步骤
            
        Returns:
            回滚结果
        """
        if self.is_running:
            raise WorkflowError("无法在工作流程运行时执行回滚")
        
        self.logger.info("开始回滚工作流程")
        
        # 确定回滚范围
        if to_step_index is None:
            rollback_steps = list(reversed(self.steps))
        else:
            rollback_steps = list(reversed(self.steps[to_step_index:]))
        
        # 创建临时上下文用于回滚
        context = WorkflowContext(
            source_path="",
            config=self.config,
            data={}
        )
        
        rollback_results = []
        
        for step in rollback_steps:
            if step.can_rollback() and step.status == StepStatus.COMPLETED:
                try:
                    self.logger.info(f"回滚步骤: {step.name}")
                    result = await step.rollback(context)
                    rollback_results.append({
                        "step_name": step.name,
                        "success": result.success,
                        "message": result.message
                    })
                    
                    if result.success:
                        step.status = StepStatus.PENDING
                        step.result = None
                    
                except Exception as e:
                    self.logger.error(f"回滚步骤失败: {step.name} - {str(e)}")
                    rollback_results.append({
                        "step_name": step.name,
                        "success": False,
                        "message": f"回滚失败: {str(e)}"
                    })
        
        self.logger.info("工作流程回滚完成")
        return {
            "success": True,
            "message": "工作流程回滚完成",
            "rollback_results": rollback_results
        }
    
    def _notify_progress_callbacks(self, step: WorkflowStep):
        """通知进度回调函数。
        
        Args:
            step: 当前步骤
        """
        progress_info = self.get_progress()
        for callback in self.progress_callbacks:
            try:
                callback(progress_info)
            except Exception as e:
                self.logger.error(f"进度回调执行失败: {e}")
    
    def _is_recoverable_error(self, error: Optional[Exception]) -> bool:
        """判断错误是否可恢复。
        
        Args:
            error: 错误对象
            
        Returns:
            是否可恢复
        """
        if isinstance(error, WorkflowError):
            return error.recoverable
        return True
    
    def _generate_workflow_result(self, step_results: List[StepResult], total_duration: float) -> Dict[str, Any]:
        """生成工作流程结果。
        
        Args:
            step_results: 步骤结果列表
            total_duration: 总执行时间
            
        Returns:
            工作流程结果字典
        """
        successful_steps = sum(1 for result in step_results if result.success)
        failed_steps = sum(1 for result in step_results if not result.success)
        
        return {
            "success": failed_steps == 0,
            "total_steps": len(step_results),
            "successful_steps": successful_steps,
            "failed_steps": failed_steps,
            "total_duration": total_duration,
            "step_results": [
                {
                    "step_name": self.steps[i].name if i < len(self.steps) else f"Step {i}",
                    "success": result.success,
                    "message": result.message,
                    "duration": result.duration,
                    "error": str(result.error) if result.error else None
                }
                for i, result in enumerate(step_results)
            ]
        }