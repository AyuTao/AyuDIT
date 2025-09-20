"""AyuDIT主入口文件。

提供应用程序的主要入口点和命令行接口。
"""

import argparse
import asyncio
import sys
from pathlib import Path

from ayu_dit.config.settings import ConfigManager
from ayu_dit.core.workflow_controller import WorkflowController
from ayu_dit.utils.logger import get_logger


def main():
    """主入口函数。"""
    parser = argparse.ArgumentParser(description="AyuDIT DaVinci Workflow Automation")
    parser.add_argument("--daemon", action="store_true", help="以守护进程模式运行")
    parser.add_argument("--config", type=str, help="配置文件路径")
    parser.add_argument("--source", type=str, help="源媒体路径")
    
    args = parser.parse_args()
    
    # 初始化配置管理器
    config_manager = ConfigManager(args.config)
    config = config_manager.load_config()
    
    # 初始化日志系统
    logger = get_logger("main")
    logger.info("AyuDIT启动中...")
    
    try:
        if args.daemon:
            # 守护进程模式 - 启动IPC服务器
            from ayu_dit.communication.ipc_server import IPCServer
            from ayu_dit.plugin_bridge import setup_ipc_handlers
            
            server = IPCServer()
            setup_ipc_handlers(server, config)
            server.start()
        else:
            # 直接模式 - 启动GUI或命令行工作流程
            if args.source:
                # 命令行模式
                asyncio.run(run_workflow_cli(args.source, config))
            else:
                # GUI模式
                from ayu_dit.ui.main_window import MainApplication
                app = MainApplication(config)
                app.run()
                
    except KeyboardInterrupt:
        logger.info("用户中断，正在退出...")
    except Exception as e:
        logger.error(f"应用程序错误: {e}")
        sys.exit(1)


async def run_workflow_cli(source_path: str, config: dict):
    """运行命令行工作流程。
    
    Args:
        source_path: 源媒体路径
        config: 配置字典
    """
    logger = get_logger("cli")
    
    try:
        controller = WorkflowController(config)
        await controller.execute_workflow(source_path)
        logger.info("工作流程完成")
    except Exception as e:
        logger.error(f"工作流程执行失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()