# Logo Conversion Script

> **Last Updated**: 2026-01-05
> **Code Location**: `scripts/convert-logo.js`
> **Status**: Active

---

## Context & Purpose

This script exists to bridge the gap between design and deployment. While SVG format is ideal for the source logo (infinitely scalable, easy to edit), Electron and operating systems require rasterized images in specific formats and sizes for application icons.

**Business Need**: LOGOS needs professional, crisp icons across all platforms (Windows, macOS, Linux) to establish brand identity. Users identify applications by their icons in taskbars, docks, start menus, and desktop shortcuts. Without proper icon conversion, the app would display generic or broken icons, appearing unprofessional.

**When Used**: This script is run manually during the build preparation phase, before packaging the Electron application for distribution. It is NOT part of the automated build pipeline - it only needs to run when the source logo (`logo.svg`) changes.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/renderer/assets/logo.svg`: The source SVG logo featuring the LOGOS brand identity (gradient circle with network nodes representing language connections and a lambda symbol)
- `sharp` (npm package): **Image processing library** (a high-performance Node.js module that converts between image formats) - handles SVG to PNG conversion and resizing
- `png-to-ico` (npm package): **ICO file generator** (converts multiple PNG images into a single Windows ICO file) - creates the multi-resolution Windows icon
- `fs` (Node.js built-in): **File system module** (reads and writes files to disk)
- `path` (Node.js built-in): **Path utilities** (constructs cross-platform file paths correctly)

### Dependents (What Needs This)

- `electron-builder.yml`: References the generated `resources/icon.png` for all platform builds
- `nsis` installer configuration: Uses generated icons for installer UI (installer icon, uninstaller icon, header icon)
- `win.icon`, `mac.icon`, `linux.icon`: All platform configurations point to the generated icon files
- Linux builds: Use the `resources/icons/` directory containing all size variants

### Data Flow

```
logo.svg (source)
    |
    v
[sharp library reads SVG buffer]
    |
    v
[Generate 8 PNG sizes: 16, 32, 48, 64, 128, 256, 512, 1024]
    |
    +---> resources/icons/{size}x{size}.png (individual files)
    |
    +---> resources/icon.png (256x256 main icon)
    |
    v
[png-to-ico combines 16, 32, 48, 64, 128, 256 sizes]
    |
    v
resources/icon.ico (Windows multi-resolution icon)
```

---

## Macroscale: System Integration

### Architectural Layer

This script sits in the **Build Tooling Layer** of the project architecture:

- **Layer 1**: Source Assets (`src/renderer/assets/logo.svg`) - design files
- **Layer 2**: Build Scripts (`scripts/convert-logo.js`) - YOU ARE HERE
- **Layer 3**: Generated Resources (`resources/`) - build artifacts
- **Layer 4**: Electron Builder (`electron-builder.yml`) - packaging configuration
- **Layer 5**: Distributable Packages (`release/`) - final output

### Big Picture Impact

This script is the **asset pipeline** for LOGOS branding. It enables:

1. **Windows Distribution**: Creates `icon.ico` containing multiple resolutions so Windows can display the appropriate size for taskbar (16px), title bar (32px), Alt+Tab (48px), and desktop shortcuts (256px)

2. **macOS Distribution**: Provides `icon.png` at high resolution for Retina displays, dock icons, and Finder previews

3. **Linux Distribution**: Generates the `resources/icons/` directory structure that Linux desktop environments expect for freedesktop.org icon themes

4. **Installer Branding**: The NSIS installer uses these icons for its UI, making the installation experience cohesive with the application branding

**Without this script**: electron-builder would fail to create properly branded installers, or would use fallback generic icons, damaging the professional appearance of LOGOS.

### Critical Path Analysis

**Importance Level**: Medium-High (Build-Time Critical)

- **If this fails**: Distribution builds cannot proceed with proper branding
- **Failure modes**:
  - Missing sharp/png-to-ico packages: Script crashes with module not found
  - Missing source SVG: Script crashes with file not found
  - Corrupted SVG: sharp fails to parse, no icons generated
  - Insufficient disk space: Write operations fail silently or partially
- **Fallback behavior**: The script has a built-in fallback for ICO generation - if `png-to-ico` fails, it copies the 256x256 PNG as `icon.ico` (which works for modern Windows but lacks multi-resolution support)
- **Recovery**: Re-run the script after fixing the underlying issue

---

## Technical Concepts (Plain English)

### SVG (Scalable Vector Graphics)
**Technical**: An XML-based vector image format that describes shapes mathematically rather than as pixels.

**Plain English**: Like a recipe for drawing rather than a photograph. You can zoom in infinitely without it getting blurry because the computer redraws it at any size.

**Why We Use It**: The logo source is SVG so designers can edit it easily and it can be converted to any resolution without quality loss.

### Rasterization
**Technical**: The process of converting vector graphics into a bitmap (pixel grid) at a specific resolution.

**Plain English**: Taking the "recipe" (SVG) and actually "cooking" it into a fixed-size photograph (PNG). Once rasterized, you cannot zoom in without seeing pixels.

**Why We Use It**: Operating systems require rasterized images for application icons because they display at fixed sizes.

### ICO Format (Multi-Resolution Icon)
**Technical**: A Windows-specific container format that bundles multiple PNG images at different resolutions into a single file.

**Plain English**: Like a Russian nesting doll containing the same picture at different sizes. Windows picks the right size depending on where it needs to show the icon.

**Why We Use It**: Windows needs different icon sizes for different contexts (taskbar vs desktop), and ICO lets us provide all sizes in one file.

### Sharp Library
**Technical**: A high-performance Node.js image processing library built on libvips, capable of resizing, converting, and manipulating images.

**Plain English**: A professional photo editing tool that runs automatically via code. It can resize and convert images much faster than most alternatives.

**Why We Use It**: Sharp is the gold standard for Node.js image processing - fast, reliable, and handles SVG input well.

### Buffer (Node.js)
**Technical**: A raw binary data container in Node.js memory, used for handling file contents before writing to disk.

**Plain English**: Like a clipboard that holds the raw bytes of a file in memory. The script reads the SVG into a buffer, processes it, and writes the result.

**Why We Use It**: Working with buffers is more efficient than repeatedly reading/writing files, especially when generating multiple sizes from the same source.

---

## Platform-Specific Icon Requirements

### Windows
- **ICO file**: Must contain 16x16, 32x32, 48x48, 64x64, 128x128, and 256x256 sizes
- **Usage**: Taskbar, Start menu, desktop shortcuts, installer UI
- **Format quirk**: ICO is a container, not an image format itself

### macOS
- **ICNS or PNG**: Can use high-resolution PNG (512x512 or 1024x1024)
- **Usage**: Dock, Finder, Spotlight, DMG installer background
- **Retina**: macOS automatically uses 2x resolution for Retina displays

### Linux
- **PNG directory**: freedesktop.org specification expects a directory structure with multiple PNG sizes
- **Usage**: Application menus, file managers, taskbars (varies by desktop environment)
- **Format**: Individual PNG files named by size (e.g., `256x256.png`)

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for the convert-logo.js script
- **Why**: Shadow Map methodology requires documentation for every code file
- **Impact**: Future developers can understand the purpose and context of this build tool
