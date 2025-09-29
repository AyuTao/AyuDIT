# ayuDITools - User Manual

Welcome to the ayuDITools plugin for DaVinci Resolve! This guide explains how to use its features to monitor your project and generate professional DIT reports.

## 1. Main Dashboard

When you launch the plugin, you will see the main dashboard, which provides an at-a-glance overview of your current project.

-   **Header Bar**:
    -   **Project Name & Total Size**: At the top right, you can see the name of the currently open DaVinci Resolve project and the total disk space used by all unique media files in the project's Media Pool.
    -   **Settings Button**: Accesses the plugin's settings panel.

-   **Statistics Cards**: Four cards display real-time counts of the different asset types in your project:
    -   **Videos**: Total count of video clips.
    -   **Audio**: Total count of audio-only clips.
    -   **Images**: Total count of still images.
    -   **Timelines**: Total count of timelines.

## 2. Report Generation

Below the main dashboard is the report generation section.

### 2.1. Selecting Timelines

-   **Timeline List**: This area lists all the timelines available in your current project. For each timeline, you can see key information:
    -   Resolution (e.g., 1920x1080)
    -   Frame Rate (fps)
    -   Total Duration
    -   Number of media clips
    -   Total size of unique media files used in that timeline.
-   **Selection**: Use the checkboxes to select one or more timelines you wish to include in the report.
-   **Controls**:
    -   **Select All / Deselect All**: Use these links to quickly select or deselect all timelines in the list.
    -   **Drag and Drop**: You can click and drag any timeline in the list to reorder it. The final report will be generated according to this order.

### 2.2. Generating Reports

Once you have selected and ordered your timelines, you have two export options:

-   **Generate PDF**: Creates a clean, professional, and visually-friendly PDF report. This report is designed for easy reading and contains the most essential metadata for each clip, including a thumbnail.
-   **Export CSV**: Creates a comprehensive Comma-Separated Values (CSV) file. This file contains **all** available metadata for every clip and is ideal for data analysis, archiving, or importing into other applications like spreadsheets.

### 2.3. Progress and Completion

-   After clicking either export button, a progress modal will appear, showing the status of the report generation.
-   Once complete, the modal will provide you with three options:
    -   **Open File**: Directly opens the generated PDF or CSV file.
    -   **Show in Folder**: Opens the folder where the file was saved.
    -   **OK**: Closes the dialog.

## 3. Settings

Click the **Settings** button in the top-right header to open the settings modal.

-   **Language**: Switch the plugin's interface language between English and Chinese.
-   **Auto Refresh**: Check this box to have the main dashboard statistics automatically refresh at a set interval.
-   **Interval (sec)**: Sets the time in seconds for the auto-refresh interval.
-   **Refresh Now**: Immediately refreshes the dashboard statistics.
-   **Thumbnail Source**: Choose which frame of the clip is used for the thumbnail in the PDF report.
    -   **First Frame**: Uses the very first frame of the clip.
    -   **Middle Frame** (Default): Uses the frame from the middle of the clip, which is generally the most reliable option.
    -   **Last Frame**: Uses the very last frame of the clip.
