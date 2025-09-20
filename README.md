# AyuDIT - DaVinci Resolve Workflow Automation System

AyuDIT是一个综合的视频制作工作流程自动化解决方案，专为DaVinci Resolve设计。它提供从初始媒体备份到最终报告生成的端到端自动化处理。

## 功能特性

- **自动媒体备份**: 创建多重备份确保数据安全
- **DaVinci Resolve集成**: 自动项目创建和媒体导入
- **智能LUT应用**: 基于元数据的自动色彩校正
- **音频同步**: 自动视频和音频同步
- **代理媒体生成**: 高效编辑的代理文件创建
- **综合报告**: 带有缩略图的详细工作流程报告
- **多语言支持**: 支持中文和英文界面

## 系统要求

- Python 3.8+
- DaVinci Resolve 18.0+
- macOS 10.15+ (当前版本)
- 足够的存储空间用于备份和代理文件

## 安装

1. 克隆仓库:
```bash
git clone https://github.com/ayudit/ayudit.git
cd ayudit
```

2. 安装依赖:
```bash
pip install -r requirements.txt
```

3. 安装应用程序:
```bash
pip install -e .
```

## 配置

首次运行时，AyuDIT会在用户主目录下创建配置文件 `~/.ayudit/config.yaml`。

### 基本配置示例

```yaml
application:
  language: "zh_CN"
  log_level: "INFO"

workflow:
  backup_locations:
    - "/backup/location1"
    - "/backup/location2"

resolve:
  auto_launch: true
  project_template: "default"

lut:
  library_path: "/path/to/luts"
  auto_apply: true

proxy:
  enabled: true
  resolution_threshold: [1920, 1080]
  codec: "ProRes Proxy"

report:
  template: "default"
  auto_open: true
```

## 使用方法

### 命令行模式

```bash
# 运行完整工作流程
ayudit --source /path/to/media

# 使用自定义配置
ayudit --source /path/to/media --config /path/to/config.yaml

# 守护进程模式（用于DaVinci插件）
ayudit --daemon
```

### GUI模式

```bash
# 启动图形界面
ayudit
```

### DaVinci Resolve插件

1. 将插件文件复制到DaVinci Resolve插件目录
2. 在DaVinci Resolve中启用工作流程集成
3. 使用插件界面启动自动化工作流程

## 开发

### 设置开发环境

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 安装pre-commit钩子
pre-commit install
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_workflow.py

# 生成覆盖率报告
pytest --cov=ayu_dit --cov-report=html
```

### 代码格式化

```bash
# 格式化代码
black ayu_dit/
isort ayu_dit/

# 检查代码质量
flake8 ayu_dit/
mypy ayu_dit/
```

## 项目结构

```
ayu_dit/
├── __init__.py
├── main.py                 # 主入口文件
├── plugin_bridge.py        # 插件桥接器
├── config/                 # 配置管理
├── core/                   # 核心工作流程
├── backup/                 # 媒体备份
├── resolve/                # DaVinci集成
├── color/                  # 色彩管理
├── audio/                  # 音频处理
├── proxy/                  # 代理生成
├── reporting/              # 报告生成
├── ui/                     # 用户界面
├── communication/          # 进程间通信
└── utils/                  # 工具模块
```

## 许可证

本项目采用MIT许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎贡献代码！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 支持

如有问题或建议，请提交Issue或联系开发团队。