# AyuDIT

> 基于 DaVinci Resolve Workflow Integration 插件体系的开源 DIT 自动化工具。

[![CI](https://github.com/AyuTao/AyuDIT/actions/workflows/ci.yml/badge.svg)](https://github.com/Tky9090/AyuTao/actions/workflows/ci.yml)

AyuDIT 目标是在片场或后期素材整理阶段，自动化完成素材拷贝、导入、LUT 套用、音频同步、代理生成以及带缩略图的报告输出。项目基于 Electron + React + Node.js + Python 技术栈，直接嵌入 DaVinci Resolve 的 Workflow Integrations 界面，实现与 Resolve API 的紧密联动。

## 主要特性
- ✅ 卡口素材拷贝、校验与任务追踪
- ✅ 调用 Resolve Media Storage API 自动导入素材并构建 Bin 结构
- ✅ 批量套用 LUT、同步音频并写入元数据
- ✅ 通过 Resolve 渲染队列生成代理并自动回链
- ✅ 基于 Resolve 缩略图和元数据生成 PDF 报告
- ✅ Workflow Integration 插件前端（Electron + React）与 Python 任务引擎协作

> 当前仓库处于架构搭建阶段，功能分支将按照 [docs/开发方案.md](docs/开发方案.md) 中的计划逐步实现。

## 系统架构概览
- **Workflow Integration 插件**：复制自官方 SamplePlugin，封装 React UI，符合 sandbox 与 contextIsolation 要求。
- **Node 调度层**：承载任务队列、IPC 管道、与 `WorkflowIntegration.node` 的交互。
- **Python 自动化层**：调用 `DaVinciResolveScript`，完成导入、LUT、音频同步、代理渲染、报告输出等任务。
- **外部工具链**：ffmpeg、ReportLab/WeasyPrint 等可选依赖用于代理与 PDF 生成。

详见 [docs/开发方案.md](docs/开发方案.md) 与 [agents.md](agents.md)。

## 开发环境准备
1. **DaVinci Resolve Studio 19.0.2+**（需要启用 Workflow Integrations）
2. **Node.js 20+ / npm 或 pnpm / yarn**
3. **Python 3.10+**（安装并配置 Resolve Scripting API 环境变量）
4. 可选依赖：`ffmpeg`, `pyenv`, `virtualenv`, `markdownlint-cli`, `ruff`

```bash
# 克隆仓库（
git clone https://github.com/AyuTao/AyuDIT.git
cd AyuDIT

# 初始化 Git 子模块或依赖（如有）
# git submodule update --init --recursive
```

## 开发流程概述
1. 运行 `npm install` / `pnpm install` 安装前端依赖（待 package.json 添加后执行）。
2. 创建 Python 虚拟环境并安装任务脚本依赖。
3. 在 `Workflow Integration Plugins` 目录下链接或复制构建后的插件目录。
4. 启动开发模式（计划引入 `npm run dev` 与热重载脚本）。
5. 在 Resolve 中打开 `Workspace -> Workflow Integrations -> AyuDIT` 进行联调。

> 详细脚本与命令将在核心代码提交后补充到 README 与 Makefile 中。

## 仓库结构
```
AyuDIT/
 ├── agents.md                 # 多代理协作说明
 ├── docs/
 │   ├── 开发方案.md            # 产品/技术方案
 │   └── 达芬奇开发者文档/...   # 官方 API 资料（只读）
 ├── README.md                 # 项目总览（当前文件）
 ├── CONTRIBUTING.md           # 贡献指南（待下节创建）
 └── .github/workflows/ci.yml  # GitHub Actions CI 配置
```

## 路线图
- [ ] 初始化 Workflow Integration 插件骨架
- [ ] 打通 Node ↔ Python IPC 与 Resolve API 调用
- [ ] 实现素材拷贝与导入流程
- [ ] 实现 LUT 套用、音频同步
- [ ] 实现代理渲染与自动挂接
- [ ] 实现 PDF 报告导出
- [ ] 补充自动化测试与打包脚本

## 贡献
项目欢迎社区参与！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解分支策略、代码规范与 PR 流程。

## 联系 & 支持
- GitHub: https://github.com/AyuTao/AyuDIT
- Issues: https://github.com/AyuTao/AyuDIT/issues
- 若希望参与讨论，可在 Issues 中创建 `discussion` 标签条目。

## 许可证
尚未确定许可证，建议在功能公开前选择适合的开源协议（如 MIT、Apache-2.0 或 GPL 家族）。

