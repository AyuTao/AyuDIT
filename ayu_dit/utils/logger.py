"""日志工具模块。

提供统一的日志记录功能，支持文件和控制台输出。
"""

import logging
import logging.handlers
import os
from pathlib import Path
from typing import Optional

from ayu_dit.config.constants import (
    DEFAULT_LOG_DIR,
    DEFAULT_LOG_FORMAT,
    DEFAULT_LOG_LEVEL,
    DEFAULT_LOG_MAX_SIZE,
    DEFAULT_LOG_BACKUP_COUNT,
)


class LoggerManager:
    """日志管理器。
    
    负责配置和管理应用程序的日志系统。
    """
    
    _instance: Optional['LoggerManager'] = None
    _initialized = False
    
    def __new__(cls) -> 'LoggerManager':
        """单例模式实现。"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化日志管理器。"""
        if not self._initialized:
            self.log_dir = DEFAULT_LOG_DIR
            self.log_level = DEFAULT_LOG_LEVEL
            self.log_format = DEFAULT_LOG_FORMAT
            self.max_size = DEFAULT_LOG_MAX_SIZE
            self.backup_count = DEFAULT_LOG_BACKUP_COUNT
            self.loggers = {}
            self._setup_root_logger()
            LoggerManager._initialized = True
    
    def configure(self, 
                  log_dir: Optional[Path] = None,
                  log_level: Optional[str] = None,
                  log_format: Optional[str] = None,
                  max_size: Optional[int] = None,
                  backup_count: Optional[int] = None):
        """配置日志系统。
        
        Args:
            log_dir: 日志目录
            log_level: 日志级别
            log_format: 日志格式
            max_size: 日志文件最大大小
            backup_count: 备份文件数量
        """
        if log_dir:
            self.log_dir = log_dir
        if log_level:
            self.log_level = log_level
        if log_format:
            self.log_format = log_format
        if max_size:
            self.max_size = max_size
        if backup_count:
            self.backup_count = backup_count
        
        # 重新配置根日志记录器
        self._setup_root_logger()
        
        # 重新配置所有已创建的日志记录器
        for logger_name in self.loggers:
            self._setup_logger(logger_name)
    
    def get_logger(self, name: str) -> logging.Logger:
        """获取日志记录器。
        
        Args:
            name: 日志记录器名称
            
        Returns:
            日志记录器实例
        """
        if name not in self.loggers:
            self.loggers[name] = self._setup_logger(name)
        return self.loggers[name]
    
    def _setup_root_logger(self):
        """设置根日志记录器。"""
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, self.log_level.upper()))
        
        # 清除现有处理器
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # 创建格式化器
        formatter = logging.Formatter(self.log_format)
        
        # 添加控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, self.log_level.upper()))
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # 确保日志目录存在
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # 添加文件处理器
        log_file = self.log_dir / "ayudit.log"
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=self.max_size,
            backupCount=self.backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(getattr(logging, self.log_level.upper()))
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    def _setup_logger(self, name: str) -> logging.Logger:
        """设置特定名称的日志记录器。
        
        Args:
            name: 日志记录器名称
            
        Returns:
            配置好的日志记录器
        """
        logger = logging.getLogger(f"ayudit.{name}")
        logger.setLevel(getattr(logging, self.log_level.upper()))
        
        # 不传播到根日志记录器（避免重复输出）
        logger.propagate = True
        
        return logger
    
    def set_log_level(self, level: str):
        """设置日志级别。
        
        Args:
            level: 日志级别（DEBUG, INFO, WARNING, ERROR, CRITICAL）
        """
        self.log_level = level.upper()
        
        # 更新根日志记录器级别
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, self.log_level))
        
        # 更新所有处理器级别
        for handler in root_logger.handlers:
            handler.setLevel(getattr(logging, self.log_level))
        
        # 更新所有子日志记录器级别
        for logger in self.loggers.values():
            logger.setLevel(getattr(logging, self.log_level))
    
    def get_log_files(self) -> list:
        """获取所有日志文件列表。
        
        Returns:
            日志文件路径列表
        """
        if not self.log_dir.exists():
            return []
        
        log_files = []
        for file_path in self.log_dir.glob("*.log*"):
            if file_path.is_file():
                log_files.append(file_path)
        
        return sorted(log_files, key=lambda x: x.stat().st_mtime, reverse=True)
    
    def clear_logs(self):
        """清除所有日志文件。"""
        for log_file in self.get_log_files():
            try:
                log_file.unlink()
            except OSError as e:
                # 如果文件正在使用中，可能无法删除
                logging.warning(f"无法删除日志文件 {log_file}: {e}")


# 全局日志管理器实例
_logger_manager = LoggerManager()


def get_logger(name: str) -> logging.Logger:
    """获取日志记录器的便捷函数。
    
    Args:
        name: 日志记录器名称
        
    Returns:
        日志记录器实例
    """
    return _logger_manager.get_logger(name)


def configure_logging(config: dict):
    """根据配置字典配置日志系统。
    
    Args:
        config: 配置字典
    """
    app_config = config.get('application', {})
    
    log_level = app_config.get('log_level', DEFAULT_LOG_LEVEL)
    log_dir = Path(app_config.get('log_dir', DEFAULT_LOG_DIR))
    
    _logger_manager.configure(
        log_dir=log_dir,
        log_level=log_level
    )


def set_log_level(level: str):
    """设置全局日志级别。
    
    Args:
        level: 日志级别
    """
    _logger_manager.set_log_level(level)


def get_log_files() -> list:
    """获取所有日志文件。
    
    Returns:
        日志文件路径列表
    """
    return _logger_manager.get_log_files()


def clear_logs():
    """清除所有日志文件。"""
    _logger_manager.clear_logs()


class WorkflowLogger:
    """工作流程专用日志记录器。
    
    提供工作流程执行过程中的专门日志记录功能。
    """
    
    def __init__(self, workflow_name: str = "workflow"):
        """初始化工作流程日志记录器。
        
        Args:
            workflow_name: 工作流程名称
        """
        self.workflow_name = workflow_name
        self.logger = get_logger(f"workflow.{workflow_name}")
        self.step_timings = {}
    
    def log_workflow_start(self, source_path: str):
        """记录工作流程开始。
        
        Args:
            source_path: 源路径
        """
        self.logger.info(f"工作流程开始: {self.workflow_name}")
        self.logger.info(f"源路径: {source_path}")
    
    def log_workflow_complete(self, duration: float, success: bool):
        """记录工作流程完成。
        
        Args:
            duration: 执行时间
            success: 是否成功
        """
        status = "成功" if success else "失败"
        self.logger.info(f"工作流程{status}: {self.workflow_name}")
        self.logger.info(f"总执行时间: {duration:.2f}秒")
    
    def log_step_start(self, step_name: str):
        """记录步骤开始。
        
        Args:
            step_name: 步骤名称
        """
        import time
        self.step_timings[step_name] = time.time()
        self.logger.info(f"步骤开始: {step_name}")
    
    def log_step_complete(self, step_name: str, success: bool, message: str = ""):
        """记录步骤完成。
        
        Args:
            step_name: 步骤名称
            success: 是否成功
            message: 附加消息
        """
        import time
        duration = 0.0
        if step_name in self.step_timings:
            duration = time.time() - self.step_timings[step_name]
            del self.step_timings[step_name]
        
        status = "成功" if success else "失败"
        self.logger.info(f"步骤{status}: {step_name} (耗时: {duration:.2f}秒)")
        if message:
            self.logger.info(f"步骤消息: {message}")
    
    def log_error(self, error: Exception, context: dict = None):
        """记录错误。
        
        Args:
            error: 错误对象
            context: 错误上下文
        """
        self.logger.error(f"错误: {str(error)}")
        if context:
            self.logger.error(f"错误上下文: {context}")
        
        # 记录异常堆栈
        import traceback
        self.logger.debug(f"异常堆栈:\n{traceback.format_exc()}")
    
    def log_progress(self, step_name: str, progress: float, message: str = ""):
        """记录进度。
        
        Args:
            step_name: 步骤名称
            progress: 进度百分比 (0-100)
            message: 进度消息
        """
        self.logger.info(f"步骤进度: {step_name} - {progress:.1f}%")
        if message:
            self.logger.info(f"进度消息: {message}")