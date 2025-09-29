# ayuDITools - 安装部署说明

本指南将引导您完成 ayuDITools 插件在 DaVinci Resolve Studio 中的安装过程。

## 系统要求

- DaVinci Resolve Studio 18.0 或更高版本。
- 您电脑的管理员权限。

## 安装步骤

1.  **下载插件**
    -   从 [GitHub Releases](https://github.com/ayu-dit/ayuDITools/releases) 页面下载最新的发行包 (`ayuDITools.zip`)。

2.  **解压文件**
    -   解压下载的 `ayuDITools.zip` 文件，您会得到一个名为 `ayuDITools` 的文件夹。

3.  **拷贝插件文件夹**
    -   将整个 `ayuDITools` 文件夹拷贝到达芬奇的 “Workflow Integration Plugins” 目录中。

    -   **在 macOS 系统:**
        -   该目录位于:
        -   `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/`

    -   **在 Windows 系统:**
        -   该目录位于:
        -   `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\`
        -   您可以直接将此路径复制并粘贴到文件资源管理器的地址栏中访问。

4.  **重启达芬奇**
    -   如果达芬奇正在运行，请完全关闭并重启它。

5.  **启动插件**
    -   重启后，您可以在达芬奇的顶部菜单中找到并启动本插件：
    -   `工作区 (Workspace)` -> `工作流程集成 (Workflow Integrations)` -> `ayuDITools`

至此，安装完成。祝您使用愉快！
