"""插件桥接器模块。

提供达芬奇插件和核心应用程序之间的桥接功能。
"""

from typing import Dict, Any

from ayu_dit.core.workflow_controller import WorkflowController
from ayu_dit.utils.logger import get_logger


def setup_ipc_handlers(ipc_server, config: Dict[str, Any]):
    """设置IPC处理器。
    
    Args:
        ipc_server: IPC服务器实例
        config: 配置字典
    """
    logger = get_logger("plugin_bridge")
    workflow_controller = WorkflowController(config)
    
    def handle_start_workflow(data: Dict[str, Any]) -> Dict[str, Any]:
        """处理启动工作流程命令。
        
        Args:
            data: 命令数据
            
        Returns:
            处理结果
        """
        try:
            source_path = data.get('source_path')
            if not source_path:
                return {
                    "success": False,
                    "error": "缺少源路径参数"
                }
            
            logger.info(f"收到启动工作流程请求: {source_path}")
            
            # 这里应该异步启动工作流程，但为了简化，先返回成功
            # 实际实现中需要使用异步任务管理
            return {
                "success": True,
                "message": "工作流程启动请求已接收",
                "workflow_id": "temp_id"
            }
            
        except Exception as e:
            logger.error(f"启动工作流程失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def handle_get_status(data: Dict[str, Any]) -> Dict[str, Any]:
        """处理获取状态命令。
        
        Args:
            data: 命令数据
            
        Returns:
            状态信息
        """
        try:
            progress = workflow_controller.get_progress()
            return {
                "success": True,
                "data": progress
            }
        except Exception as e:
            logger.error(f"获取状态失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def handle_stop_workflow(data: Dict[str, Any]) -> Dict[str, Any]:
        """处理停止工作流程命令。
        
        Args:
            data: 命令数据
            
        Returns:
            处理结果
        """
        try:
            workflow_controller.stop_workflow()
            return {
                "success": True,
                "message": "工作流程停止请求已发送"
            }
        except Exception as e:
            logger.error(f"停止工作流程失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # 注册处理器
    ipc_server.register_handler("start_workflow", handle_start_workflow)
    ipc_server.register_handler("get_status", handle_get_status)
    ipc_server.register_handler("stop_workflow", handle_stop_workflow)
    
    logger.info("IPC处理器设置完成")