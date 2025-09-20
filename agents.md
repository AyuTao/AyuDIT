# Agents Playbook for AyuDIT

## 1. Product Planner Agent
- **目标**：整理片场 DIT 需求，更新功能范围、优先级、时间表。
- **输入**：用户反馈、Bug/Feature 列表、测试报告。
- **输出**：迭代计划、需求文档、风险提示。
- **协作**：与 Workflow Plugin Agent 同步 UI/UX 需求，与 Automation Agent 协调接口。

## 2. Workflow Plugin Agent (Electron/React)
- **目标**：实现 Resolve 内 Workflow Integration 插件 UI 与前端逻辑。
- **职责**：
  - 维护 React 组件与状态管理。
  - 调用预加载脚本暴露的安全 API，触发任务。
  - 展示拷贝、导入、LUT、代理、报告等流程进度。
- **输入**：Planner 的 UX/流程说明，Automation Agent 的 IPC 契约。
- **输出**：编译后的插件包、UI 单元测试、前端日志。

## 3. Integration Node Agent
- **目标**：作为中心调度与编排层。
- **职责**：
  - 管理任务队列与持久化（SQLite/JSON）。
  - 调用 `WorkflowIntegration.node` 与 Resolve JS API。
  - 启动/监控 Python 子进程，处理 IPC 消息。
- **输入**：Workflow Plugin Agent 的指令。
- **输出**：任务状态更新、Resolve API 调用日志、错误告警。

## 4. Automation Python Agent
- **目标**：执行重计算与 Resolve 脚本 API 调用。
- **职责**：
  - 素材拷贝、校验（哈希）。
  - `DaVinciResolveScript` 操作：导入媒体、套 LUT、音频同步、渲染代理。
  - 调用 ffmpeg、ReportLab 生成 PDF 报告。
- **输入**：Integration Node Agent 提供的任务参数。
- **输出**：任务结果 JSON、生成的文件路径、错误报告。

## 5. QA & Monitoring Agent
- **目标**：保障质量与运行稳定性。
- **职责**：
  - 编写/维护自动化测试脚本（前端、Python、端到端）。
  - 监控运行日志，识别异常任务。
  - 生成状态报表供 Planner 复盘。
- **输入**：所有执行人输出的日志与测试结果。
- **输出**：缺陷报告、测试通过率、改进建议。

## 协作节奏
1. Planner 根据最新需求出迭代计划。
2. Workflow Plugin & Integration Node 共同定义 IPC 契约。
3. Automation Python 落地脚本与外部工具集成。
4. QA Agent 编写测试并在每个里程碑前执行。
5. 阶段结束时，所有 Agent 提交状态供 Planner 更新 Roadmap。

