"""进程间通信服务器模块。

提供达芬奇插件和核心应用程序之间的通信机制。
"""

import json
import socket
import threading
from typing import Dict, Any, Callable, Optional

from ayu_dit.utils.logger import get_logger


class IPCServer:
    """IPC服务器类。"""
    
    def __init__(self, host: str = 'localhost', port: int = 9999):
        """初始化IPC服务器。
        
        Args:
            host: 服务器主机
            port: 服务器端口
        """
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.running = False
        self.handlers: Dict[str, Callable] = {}
        self.logger = get_logger("ipc_server")
    
    def register_handler(self, command: str, handler: Callable):
        """注册命令处理器。
        
        Args:
            command: 命令名称
            handler: 处理函数
        """
        self.handlers[command] = handler
        self.logger.debug(f"注册处理器: {command}")
    
    def start(self):
        """启动服务器。"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind((self.host, self.port))
            self.socket.listen(5)
            
            self.running = True
            self.logger.info(f"IPC服务器启动在 {self.host}:{self.port}")
            
            while self.running:
                try:
                    client_socket, address = self.socket.accept()
                    self.logger.info(f"客户端连接: {address}")
                    
                    # 为每个客户端创建处理线程
                    client_thread = threading.Thread(
                        target=self._handle_client,
                        args=(client_socket,)
                    )
                    client_thread.daemon = True
                    client_thread.start()
                    
                except socket.error:
                    if self.running:
                        self.logger.error("接受客户端连接失败")
                    
        except Exception as e:
            self.logger.error(f"启动IPC服务器失败: {e}")
    
    def _handle_client(self, client_socket: socket.socket):
        """处理客户端连接。
        
        Args:
            client_socket: 客户端套接字
        """
        try:
            while self.running:
                # 接收消息
                data = client_socket.recv(4096)
                if not data:
                    break
                
                try:
                    message = json.loads(data.decode('utf-8'))
                    command = message.get('command')
                    params = message.get('data', {})
                    
                    self.logger.debug(f"收到命令: {command}")
                    
                    # 处理命令
                    if command in self.handlers:
                        result = self.handlers[command](params)
                    else:
                        result = {
                            "success": False,
                            "error": f"未知命令: {command}"
                        }
                    
                    # 发送响应
                    response = json.dumps(result, ensure_ascii=False).encode('utf-8')
                    client_socket.send(response)
                    
                except json.JSONDecodeError:
                    error_response = json.dumps({
                        "success": False,
                        "error": "无效的JSON消息"
                    }, ensure_ascii=False).encode('utf-8')
                    client_socket.send(error_response)
                    
        except Exception as e:
            self.logger.error(f"处理客户端失败: {e}")
        finally:
            client_socket.close()
    
    def stop(self):
        """停止服务器。"""
        self.running = False
        if self.socket:
            self.socket.close()
        self.logger.info("IPC服务器已停止")


class IPCClient:
    """IPC客户端类。"""
    
    def __init__(self, host: str = 'localhost', port: int = 9999):
        """初始化IPC客户端。
        
        Args:
            host: 服务器主机
            port: 服务器端口
        """
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.logger = get_logger("ipc_client")
    
    def connect(self) -> bool:
        """连接到服务器。
        
        Returns:
            是否连接成功
        """
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            self.logger.info(f"连接到IPC服务器 {self.host}:{self.port}")
            return True
            
        except Exception as e:
            self.logger.error(f"连接IPC服务器失败: {e}")
            return False
    
    def send_command(self, command: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """发送命令到服务器。
        
        Args:
            command: 命令名称
            data: 命令数据
            
        Returns:
            服务器响应
        """
        try:
            message = {
                "command": command,
                "data": data
            }
            
            # 发送消息
            message_json = json.dumps(message, ensure_ascii=False).encode('utf-8')
            self.socket.send(message_json)
            
            # 接收响应
            response_data = self.socket.recv(4096)
            response = json.loads(response_data.decode('utf-8'))
            
            return response
            
        except Exception as e:
            self.logger.error(f"发送命令失败: {e}")
            return {"success": False, "error": str(e)}
    
    def disconnect(self):
        """断开连接。"""
        if self.socket:
            self.socket.close()
            self.socket = None
        self.logger.info("已断开IPC连接")
    
    def is_connected(self) -> bool:
        """检查是否已连接。
        
        Returns:
            是否已连接
        """
        return self.socket is not None