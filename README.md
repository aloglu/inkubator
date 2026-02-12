# Inkubator

Inkubator is a local-first application for tracking fountain pens, inks, and swatches. Use it to organize your collection, manage currently inked pairings, and generate a static website to showcase your collection.

You can view a live demonstration of the generated showcase at [alog.lu/inkubator](https://alog.lu/inkubator).

## Features

### Collection Management
*   **Detailed Cataloging**: Track details like nib material, size, nib type, filling system, and more.
*   **Pen Status**: See at a glance which pens are currently inked or resting.
*   **Ink Characteristics**: Log shading, sheen, shimmer, flow, dry time, and more.
*   **Local Storage**: All data is stored locally in `data.json`.

### Automatic Color Extraction
*   **Color Detection**: Uses a local model to identify pens in photos and extract dominant colors.
*   **Palette Generation**: Creates a color palette for your items automatically. You can edit the palette manually.

### Pairing and History
*   **Currently Inked**: A dashboard for your active pen and ink combinations.
*   **Swatches**: Attach swatch photos to inks with details on paper and lighting, either automatically or manually.

### Public Showcase
*   **Static Website**: Export your collection as a responsive, read-only website.
*   **Navigation**: Optimized for both desktop and mobile browsing.

> [!IMPORTANT]
> To host your generated showcase, the following files and directories must be uploaded to your static hosting provider:
> *   Folders: `images/`, `renderer/`
> *   Files: `index.html`, `style.css`, `renderer.js`, `data.json`

### Backups and Portability
*   **Automatic Backups**: Keeps up to 200 snapshots of your library.
*   **Data Portability**: Export your entire database and image folder easily.

## Getting Started

### Standalone Installation
The simplest way to use Inkubator is to download the pre-compiled binaries for your operating system from the [Releases](https://github.com/aloglu/inkubator/releases) page.

### Development and Building from Source
Follow these steps if you intend to modify the codebase or build the application manually.

**Prerequisites**
Access to the following tools is required for the development environment:
*   **Node.js**: v18.0.0 or higher
*   **npm**: v9.0.0 or higher

**Setup**
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/aloglu/inkubator.git
    cd inkubator
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

**Execution Commands**
*   **Management Mode (Desktop)**: `npm start` (Runs the Electron application for library management).
*   **Showcase Mode (Web Preview)**: `npm run showcase` (Serves the static collection for browser previewing).

## Technical Stack
- **Core**: Electron, Vanilla JavaScript, CSS3 (Glassmorphism UI)
- **AI/ML**: ONNX Runtime (U2Net Model)
- **Graphics**: Sharp (WebP optimization & rotation handling)
- **Data**: Local JSON with `fs-extra` persistence

## OS Security Notice
As an unsigned application, you may encounter system warnings:
- **Windows**: Click `More info` → `Run anyway`.
- **macOS**: `Right-click` the app → `Open`, or authorize via `System Settings > Privacy & Security`.

## License
Released under the [MIT License](https://github.com/aloglu/inkubator/blob/main/LICENSE).