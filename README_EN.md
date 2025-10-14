# AyuDIT: The Professional, Subscription-Free DIT Software for DaVinci Resolve

`AyuDIT`  is not just a plugin; it's a complete and powerful DIT (Digital Imaging Technician) software solution built directly within DaVinci Resolve Studio. It's the perfect, subscription-free alternative to expensive annual-fee software like Pomfort Silverstack Lab and Foolcat.
## Why AyuDIT?

The vision for `AyuDIT` was born from a major shift in the post-production landscape. With DaVinci Resolve 20's native support for Apple ProRes RAW, the platform has become a truly universal tool, capable of handling nearly every format and unifying the entire post-production workflow.

This presented a unique opportunity: to leverage the power of Resolve's backend to create a comprehensive DIT tool without the high costs. With `AyuDIT`, you no longer need to pay for expensive annual licenses. All you need is a license for DaVinci Resolve Studio.

![AyuDIT Screenshot](https://i.imgur.com/your-screenshot-url.png)
*(Replace this with a URL to your screenshot)*

## Features

-   **Dashboard Stats (4 cards)**: Video, Audio, Timelines, and Total Size (unique media in Media Pool).
-   **Multi‑timeline selection + drag reorder**: Choose timelines and control output order.
-   **PDF report with thumbnails**: Clean pages per timeline with key metadata. Now supports an optional, centered cover page with logo, current date, project stats, DIT name, and custom fields.
-   **CSV export**: Full metadata for every clip across selected timelines.
-   **Thumbnail export (stills)**:
    -   Export All Timeline Clips
    -   Export Marked Clips Only (uses timeline markers on the ruler)
    -   File naming: `TimelineName-Timecode.jpg`
    -   Export folder name is localized, e.g. `Stills_<Project>_<YYYYMMDD_HHMMSS>` or `单帧_...`
-   **Configurable thumbnail source**: First, Middle (default), or Last frame (for PDF and All‑clips stills).
-   **Always-on-top progress modal**: With live percentage and quick actions.
-   **Multi-language**: English and Chinese; dialog titles and folder prefixes follow language.
-   **Refresh + Auto-refresh**: Header refresh button and interval refresh (default 60s) update the dashboard and timeline list.

## Requirements

-   **DaVinci Resolve Studio version 20.2 or newer.**
-   The Studio version is **required**.

## Installation

For detailed installation instructions, please see the [Installation Guide](INSTALL.md).

1.  Download the latest `AyuDIT.zip` from the [releases page](https://github.com/AyuTao/AyuDIT/releases).
2.  Unzip the file.
3.  Copy the entire `AyuDIT` folder to the Resolve Workflow Integration Plugins directory.
4.  Restart DaVinci Resolve.
5.  Launch from `Workspace` > `Workflow Integrations` > `AyuDIT`.

## Usage

For a complete guide and workflow details, see the [User Manual](USER_MANUAL.md).

Quick tips:

- Select at least one timeline before exporting.
- For “Marked Clips Only”, add timeline markers on the ruler; the app exports one still per marker.
- PDF cover page options (enable, DIT name, custom fields, logo) are in Settings.

## License

This project is licensed under the **GNU General Public License v3.0**. This means that if you use, distribute, or modify this code, you must also make your derivative work open source under the same license. Please see the [LICENSE](LICENSE) file for full details.
