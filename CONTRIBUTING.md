# Contributing to AyuDIT

感谢关注 AyuDIT！以下指南帮助你快速参与项目开发。

## 快速开始
1. Fork 仓库并克隆到本地：
   ```bash
   git clone https://github.com/AyuTao/AyuDIT.git
   cd AyuDIT
   git remote add upstream https://github.com/AyuTao/AyuDIT.git
   ```
2. 创建特性分支：
   ```bash
   git checkout -b feat/<topic>
   ```
3. 按照 [docs/开发方案.md](docs/开发方案.md) 与 `issues` 讨论实现任务。
4. 提交前运行格式化/测试命令（见下文）。
5. 通过 Pull Request 提交，描述变更、测试情况与关联 Issue。

## 分支与提交约定
- `main`：稳定分支，对应已验证功能。
- `develop`：集成分支，用于合并新特性。
- 功能分支命名：`feat/<scope>`, `fix/<bug-id>`, `docs/<topic>`, `chore/<task>`。
- 提交信息参考 Conventional Commits：
  - `feat: add resolve import pipeline`
  - `fix: handle proxy render job failure`
  - `docs: update setup guide`

## 代码规范
- **Node/TypeScript**：计划使用 ESLint + Prettier；待前端代码引入后补充 `.eslintrc` 与格式化脚本。
- **Python**：使用 Ruff（格式化 + lint）与 pytest；配置将在任务脚本提交时加入。
- **文档**：遵循 MarkdownLint 规则（CI 已覆盖）并尽量保持中英文一致。

推荐在提交前运行：
```bash
# Markdown 检查
npm exec markdownlint "**/*.md"

# Python 语法检查
ruff check .
ruff format --check .

# 单元测试（待脚本实现）
pytest
```

> 若仓库暂未包含某些依赖（如 `package.json`、`pyproject.toml`），请在 PR 中同步添加。

## PR 审核流程
1. 自检：确认 CI 通过、描述清晰、截图/日志完整。
2. 提交 PR 至 `develop`，指明功能背景、实现细节、测试范围。
3. 至少 1 名 Maintainer 或核心贡献者审核后合并。
4. 若涉及 API 变更，请更新 `docs/开发方案.md` 与 README 相关段落。

## Issue & Discussion
- 使用 Issue 模板描述 Bug / Feature / Question。
- 提交 Bug 时请附带 Resolve 版本、操作系统、日志输出。
- 提交 Feature 时可参考 `agents.md` 协作流程，说明需求场景及优先级。

## 发布流程（规划）
1. 在 `develop` 分支完成里程碑功能后，创建 Release PR 合并至 `main`。
2. 更新版本号（未来会引入 `CHANGELOG.md` 与自动化发布脚本）。
3. 打包 Workflow Integration 插件目录并附带 README、许可证、依赖说明。

## 行为准则
请遵守通用社区行为准则（CoC），尊重每位贡献者的时间与劳动。若仓库后续添加 `CODE_OF_CONDUCT`, 请以其为准。

欢迎加入 AyuDIT，一起打造更高效的 DIT 工作流！

