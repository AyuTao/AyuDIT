"""常量定义模块。

定义应用程序中使用的常量和默认值。
"""

from pathlib import Path

# 应用程序信息
APP_NAME = "AyuDIT"
APP_VERSION = "1.0.0"

# 默认路径
DEFAULT_CONFIG_DIR = Path.home() / ".ayudit"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.yaml"
DEFAULT_LOG_DIR = DEFAULT_CONFIG_DIR / "logs"
DEFAULT_CACHE_DIR = DEFAULT_CONFIG_DIR / "cache"

# 达芬奇相关路径
RESOLVE_PLUGIN_DIR = Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins")
RESOLVE_SCRIPT_API = Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting")

# IPC配置
DEFAULT_IPC_HOST = "localhost"
DEFAULT_IPC_PORT = 9999

# 日志配置
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DEFAULT_LOG_MAX_SIZE = 10 * 1024 * 1024  # 10MB
DEFAULT_LOG_BACKUP_COUNT = 5

# 工作流程配置
DEFAULT_BACKUP_LOCATIONS = []
DEFAULT_PROXY_RESOLUTION_THRESHOLD = (1920, 1080)
DEFAULT_PROXY_CODEC = "ProRes Proxy"

# 支持的媒体格式
SUPPORTED_VIDEO_FORMATS = {".mov", ".mp4", ".avi", ".mxf", ".r3d", ".braw"}
SUPPORTED_AUDIO_FORMATS = {".wav", ".aiff", ".mp3", ".aac"}
SUPPORTED_LUT_FORMATS = {".cube", ".3dl", ".lut"}

# 语言配置
SUPPORTED_LANGUAGES = {"zh_CN", "en_US"}
DEFAULT_LANGUAGE = "zh_CN"