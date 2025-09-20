"""自定义异常模块。

定义工作流程中使用的各种异常类型。
"""


class WorkflowError(Exception):
    """工作流程基础异常。"""
    
    def __init__(self, message: str, error_code: str = "", recoverable: bool = True):
        """初始化工作流程异常。
        
        Args:
            message: 错误消息
            error_code: 错误代码
            recoverable: 是否可恢复
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.recoverable = recoverable


class WorkflowStepError(WorkflowError):
    """工作流程步骤异常。"""
    
    def __init__(self, step_name: str, message: str, error_code: str = "", recoverable: bool = True):
        """初始化步骤异常。
        
        Args:
            step_name: 步骤名称
            message: 错误消息
            error_code: 错误代码
            recoverable: 是否可恢复
        """
        super().__init__(f"步骤 '{step_name}' 失败: {message}", error_code, recoverable)
        self.step_name = step_name


class ConfigError(WorkflowError):
    """配置相关异常。"""
    
    def __init__(self, message: str, config_key: str = ""):
        """初始化配置异常。
        
        Args:
            message: 错误消息
            config_key: 相关配置键
        """
        super().__init__(f"配置错误: {message}", "CONFIG_ERROR", False)
        self.config_key = config_key


class ResolveConnectionError(WorkflowError):
    """达芬奇连接异常。"""
    
    def __init__(self, message: str = "无法连接到DaVinci Resolve"):
        """初始化达芬奇连接异常。
        
        Args:
            message: 错误消息
        """
        super().__init__(message, "RESOLVE_CONNECTION_ERROR", True)


class MediaImportError(WorkflowError):
    """媒体导入异常。"""
    
    def __init__(self, message: str, media_path: str = ""):
        """初始化媒体导入异常。
        
        Args:
            message: 错误消息
            media_path: 媒体文件路径
        """
        super().__init__(f"媒体导入失败: {message}", "MEDIA_IMPORT_ERROR", True)
        self.media_path = media_path


class BackupError(WorkflowError):
    """备份异常。"""
    
    def __init__(self, message: str, source_path: str = "", destination_path: str = ""):
        """初始化备份异常。
        
        Args:
            message: 错误消息
            source_path: 源路径
            destination_path: 目标路径
        """
        super().__init__(f"备份失败: {message}", "BACKUP_ERROR", True)
        self.source_path = source_path
        self.destination_path = destination_path


class LUTError(WorkflowError):
    """LUT处理异常。"""
    
    def __init__(self, message: str, lut_path: str = ""):
        """初始化LUT异常。
        
        Args:
            message: 错误消息
            lut_path: LUT文件路径
        """
        super().__init__(f"LUT处理失败: {message}", "LUT_ERROR", True)
        self.lut_path = lut_path


class AudioSyncError(WorkflowError):
    """音频同步异常。"""
    
    def __init__(self, message: str, video_path: str = "", audio_path: str = ""):
        """初始化音频同步异常。
        
        Args:
            message: 错误消息
            video_path: 视频文件路径
            audio_path: 音频文件路径
        """
        super().__init__(f"音频同步失败: {message}", "AUDIO_SYNC_ERROR", True)
        self.video_path = video_path
        self.audio_path = audio_path


class ProxyGenerationError(WorkflowError):
    """代理生成异常。"""
    
    def __init__(self, message: str, source_path: str = ""):
        """初始化代理生成异常。
        
        Args:
            message: 错误消息
            source_path: 源文件路径
        """
        super().__init__(f"代理生成失败: {message}", "PROXY_GENERATION_ERROR", True)
        self.source_path = source_path


class ReportGenerationError(WorkflowError):
    """报告生成异常。"""
    
    def __init__(self, message: str, report_type: str = ""):
        """初始化报告生成异常。
        
        Args:
            message: 错误消息
            report_type: 报告类型
        """
        super().__init__(f"报告生成失败: {message}", "REPORT_GENERATION_ERROR", True)
        self.report_type = report_type