"""工作流程步骤基类模块。

提供所有工作流程步骤的基础接口和通用功能。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

from ayu_dit.utils.logger import get_logger


class StepStatus(Enum):
    """步骤状态枚举。"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class StepResult:
    """步骤执行结果。"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[Exception] = None
    duration: float = 0.0


@dataclass
class WorkflowContext:
    """工作流程上下文。
    
    在工作流程步骤之间传递数据和状态。
    """
    source_path: str
    config: Dict[str, Any]
    data: Dict[str, Any]
    
    def __post_init__(self):
        """初始化后处理。"""
        if self.data is None:
            self.data = {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取上下文数据。
        
        Args:
            key: 数据键
            default: 默认值
            
        Returns:
            数据值
        """
        return self.data.get(key, default)
    
    def set(self, key: str, value: Any):
        """设置上下文数据。
        
        Args:
            key: 数据键
            value: 数据值
        """
        self.data[key] = value
    
    def update(self, data: Dict[str, Any]):
        """批量更新上下文数据。
        
        Args:
            data: 要更新的数据字典
        """
        self.data.update(data)


class WorkflowStep(ABC):
    """工作流程步骤基类。
    
    所有工作流程步骤都应该继承此类并实现execute方法。
    """
    
    def __init__(self, name: str, description: str = "") -> None:
        """初始化工作流程步骤。
        
        Args:
            name: 步骤名称
            description: 步骤描述
        """
        self.name = name
        self.description = description
        self.status = StepStatus.PENDING
        self.logger = get_logger(f"step.{name}")
        self.result: Optional[StepResult] = None
    
    @abstractmethod
    async def execute(self, context: WorkflowContext) -> StepResult:
        """执行工作流程步骤。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            步骤执行结果
            
        Raises:
            WorkflowStepError: 步骤执行失败时抛出
        """
        pass
    
    def can_rollback(self) -> bool:
        """检查步骤是否支持回滚。
        
        Returns:
            是否支持回滚
        """
        return False
    
    async def rollback(self, context: WorkflowContext) -> StepResult:
        """回滚步骤操作。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            回滚结果
        """
        return StepResult(
            success=True,
            message=f"步骤 {self.name} 不支持回滚"
        )
    
    def validate_prerequisites(self, context: WorkflowContext) -> bool:
        """验证步骤执行的前置条件。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            是否满足前置条件
        """
        return True
    
    def get_progress_info(self) -> Dict[str, Any]:
        """获取步骤进度信息。
        
        Returns:
            进度信息字典
        """
        return {
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "result": {
                "success": self.result.success if self.result else None,
                "message": self.result.message if self.result else None,
                "duration": self.result.duration if self.result else 0.0
            } if self.result else None
        }


class ConditionalStep(WorkflowStep):
    """条件步骤基类。
    
    根据条件决定是否执行的步骤。
    """
    
    def __init__(self, name: str, description: str = "", condition_func=None):
        """初始化条件步骤。
        
        Args:
            name: 步骤名称
            description: 步骤描述
            condition_func: 条件判断函数
        """
        super().__init__(name, description)
        self.condition_func = condition_func
    
    def should_execute(self, context: WorkflowContext) -> bool:
        """判断是否应该执行此步骤。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            是否应该执行
        """
        if self.condition_func:
            return self.condition_func(context)
        return True
    
    async def execute(self, context: WorkflowContext) -> StepResult:
        """执行条件步骤。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            步骤执行结果
        """
        if not self.should_execute(context):
            self.status = StepStatus.SKIPPED
            return StepResult(
                success=True,
                message=f"步骤 {self.name} 被跳过（不满足执行条件）"
            )
        
        return await self._execute_impl(context)
    
    @abstractmethod
    async def _execute_impl(self, context: WorkflowContext) -> StepResult:
        """实际执行逻辑。
        
        Args:
            context: 工作流程上下文
            
        Returns:
            步骤执行结果
        """
        pass


class ParallelStep(WorkflowStep):
    """并行步骤基类。
    
    可以与其他步骤并行执行的步骤。
    """
    
    def __init__(self, name: str, description: str = "", max_concurrent: int = 1):
        """初始化并行步骤。
        
        Args:
            name: 步骤名称
            description: 步骤描述
            max_concurrent: 最大并发数
        """
        super().__init__(name, description)
        self.max_concurrent = max_concurrent
    
    def can_run_parallel(self) -> bool:
        """检查是否可以并行运行。
        
        Returns:
            是否可以并行运行
        """
        return True
    
    def get_dependencies(self) -> list:
        """获取步骤依赖。
        
        Returns:
            依赖步骤列表
        """
        return []