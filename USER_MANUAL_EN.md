# AyuDIT - User Manual

Welcome to the AyuDIT plugin for DaVinci Resolve! This guide explains how to use its features to monitor your project and generate professional DIT reports.

## 1. Main Dashboard

When you launch the plugin, you will see the main dashboard, which provides an at-a-glance overview of your current project.

-   **Header Bar**:
    -   **Refresh**: Click the refresh icon to update both the dashboard and the timeline list.
    -   **Project Name**: The currently open Resolve project.
    -   **Settings**: Opens the settings panel.

-   **Statistics Cards (4)**
    -   **Videos**: Count of video clips in the Media Pool.
    -   **Audio**: Count of audio‑only clips in the Media Pool.
    -   **Timelines**: Count of timelines in the project.
    -   **Total Size**: Sum of unique media sizes referenced by the Media Pool.

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

-   **Generate PDF**: Creates a clean, professional PDF per timeline with thumbnails and key metadata. Optionally includes a centered cover page with logo, date, project stats, DIT name, and custom fields.
-   **Export CSV**: Creates a comprehensive CSV containing all available metadata for every clip across the selected timelines.

### 2.3. Export Thumbnails (Stills)

-   Click “Export Thumbnails” to open the mode selector.
-   Modes:
    -   **Export All Timeline Clips**: Exports one still per clip using the configured thumbnail source (first/middle/last).
    -   **Export Marked Clips Only**: Exports one still per timeline marker (placed on the timeline ruler). If no markers are found, you will be prompted.
-   File naming: `TimelineName-Timecode.jpg`
-   Export folder name is localized, e.g. `Stills_<Project>_<YYYYMMDD_HHMMSS>` or `单帧_...`.

### 2.4. Progress and Completion

-   After clicking either export button, a progress modal will appear, showing the status of the report generation.
-   Once complete, the modal will provide you with three options:
    -   **Open File**: Directly opens the generated PDF or CSV file.
    -   **Show in Folder**: Opens the folder where the file was saved.
    -   **OK**: Closes the dialog.

## 3. Settings

Click the **Settings** button in the top-right header to open the settings modal.

-   **Language**: Switch the UI between English and Chinese (affects dialog titles and export folder names as well).
-   **Auto Refresh**: Periodically updates both the dashboard and the timeline list.
-   **Interval (sec)**: Interval for auto‑refresh (default 60s).
-   **Thumbnail Source**: Choose which frame of the clip is used for thumbnails in the PDF and All‑clips stills.
    -   **First Frame**: Uses the very first frame of the clip.
    -   **Middle Frame** (Default): Uses the frame from the middle of the clip, which is generally the most reliable option.
    -   **Last Frame**: Uses the very last frame of the clip.
    
-   **Report Logo**: Change or reset the logo displayed in PDF reports.
-   **PDF Cover Page**:
    -   Enable/disable cover page
    -   DIT Name
    -   Custom fields (one per line, e.g. `Client: ACME`)

## 4. Tips

-   Select at least one timeline before exporting.
-   You can reorder timelines by dragging them in the list.
-   “Marked Clips Only” uses timeline markers (not Media Pool metadata).
-   The middle frame is often the best thumbnail choice when unsure.
