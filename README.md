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
*   **Activity Log**: Track key collection actions (adding/editing/deleting pens, inks, swatches, inking changes) with optional visibility in the public showcase.

### Public Showcase
*   **Static Website**: Export your collection as a responsive, read-only website.
*   **Navigation**: Optimized for both desktop and mobile browsing.

### Backups and Portability
*   **Automated Backups (Data Only)**: Keeps up to 200 automatic snapshots of normalized collection data.
*   **Full Backup Export/Import (Data + Images)**: Use manual export/import when you need complete portability including image files.

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

## License
Released under the [MIT License](https://github.com/aloglu/inkubator/blob/main/LICENSE).
