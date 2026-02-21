# Inkubator

Inkubator is a local-first desktop application for managing and cataloging fountain pen and ink collections. It provides a centralized interface for pen, ink, and swatch management, activity tracking, statistics, and static showcase generation from local data.

[Live Showcase Demonstration](https://alog.lu/inkubator) | [Latest Releases](https://github.com/aloglu/inkubator/releases)

## Features

### Collection Management
* **Pen Management**: Maintain detailed pen records with structured fields such as manufacturer, model, nib material, tip size, nib type, filling system, condition, status, and additional details.
* **Ink Management**: Maintain detailed ink records including brand, line, name, color values, bottle and sample metadata, inventory and ownership state, performance characteristics (shading, sheen, shimmer, flow, dry time), and additional details.
* **Swatch Management**: Attach and manage multiple independent swatches per ink with per-swatch metadata, image support, and separate swatches for different testing conditions.
* **Dynamic Filtering**: Filter and browse pens, inks, and swatches using their metadata to quickly locate specific items and hide irrelevant or empty views.
* **Stats Page**: Get a clear overview of your collection with totals, category breakdowns, and activity-based metrics in one place.
* **Status and Activity Tracking**: Track pen states (Inked, Cleaned, Resting) and keep an automatic log of additions, edits, and inking history, with optional inclusion in static website exports.
* **Built-In Color Assistance**: Optionally use local image analysis to isolate subjects and extract dominant color values from swatch photos.
* **Dark Mode Support**: Both the desktop application and the generated showcase include dark mode.
* **Local Persistence**: All data is stored in a structured `data.json` file without mandatory account creation or cloud dependency.

### Data Integrity & Portability
* **Manual and Automated Backups**: Create backups on demand or rely on scheduled snapshots for both data and images.
* **Full Archive Export**: A manual Export/Import feature allows for complete library migration between devices by bundling data and media into a single portable archive.

### Static Site Generation (SSG)
* **Showcase Export**: The application generates a responsive, read-only static website from the local database.
* **Deployment**: The `showcase/` directory is portable and compatible with any static hosting provider (e.g., GitHub Pages, Vercel, S3).

### Technical Stack

* **Core Runtime**: Electron / Node.js
* **Frontend**: Vanilla JavaScript / CSS3
* **Image Processing**: Sharp (WebP optimization, metadata-aware rotation)
* **ML Inference**: ONNX Runtime
* **Filesystem**: `fs-extra` for persistent JSON storage

## Getting Started

### Binary Execution
Pre-compiled binaries for supported operating systems are available via the GitHub [Releases](https://github.com/aloglu/inkubator/releases) page.

### Source Build & Development
**Prerequisites**: Node.js (v18.0.0+) and npm (v9.0.0+).

1. **Repository Initialization**:
   ```bash
   git clone https://github.com/aloglu/inkubator.git
   cd inkubator
   ```

2. **Dependency Installation**:
   ```bash
   npm install
   ```

3. **CLI Commands**:
   * `npm start`: Initialize the Electron management interface.
   * `npm run showcase`: Launch a local development server for the static showcase.

## License
This project is licensed under the [MIT License](https://github.com/aloglu/inkubator/blob/main/LICENSE).