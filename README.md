# Inkubator

Inkubator is a local-first desktop application for the management and cataloging of fountain pen and ink collections. It provides a centralized interface for tracking hardware specifications, ink usage history, and generating static web-based showcases from local datasets.

[Live Showcase Demonstration](https://alog.lu/inkubator) | [Latest Releases](https://github.com/aloglu/inkubator/releases)

## Features

### Collection Management
* **Hardware Cataloging**: Detailed fields for nib material, tip size, nib type (e.g., flex, italic), filling systems, and manufacturer specifications.
* **Status Tracking**: Real-time monitoring of pen states, distinguishing between active (Inked) and storage (Cleaned/Resting) status.
* **Ink Performance Logging**: Standardized tracking for shading, sheen, shimmer, flow rate, and dry times.
* **Local Persistence**: All data is stored in a structured `data.json` file. The application operates without external cloud dependencies or mandatory account creation.

### Swatch & Activity Tracking
* **Relational Mapping**: Support for multiple independent swatches per ink record.
* **Metadata Granularity**: Filter swatches by lighting conditions, nib used, and paper type with dynamic visibility for empty datasets.
* **Audit Log**: An automated activity log tracks additions, modifications, and inking history. This log can be selectively included in public exports.

### Computer Vision & Color Processing
* **Automated Extraction**: Utilizes a local ONNX model (U2Net) to isolate items in photographs and extract dominant hex color codes.
* **Palette Management**: Automatic generation of color palettes for inks and pens with manual override capabilities for precise color matching.

## Data Integrity & Portability
* **Automated Backups**: Inkubator performs scheduled snapshots of both the JSON database and the image repository for disaster recovery.
* **Full Archive Export**: A manual Export/Import feature allows for complete library migration between devices by bundling data and media into a single portable archive.

### Static Site Generation (SSG)
* **Showcase Export**: The application generates a responsive, read-only static website from the local database.
* **Deployment**: The `showcase/` directory is portable and compatible with any static hosting provider (e.g., GitHub Pages, Vercel, S3).

## Technical Stack

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