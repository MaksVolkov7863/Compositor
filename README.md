# Compositor

> [!NOTE]
> **Windows Community Edition**: Looking for the Windows build? Download ready-to-run installers and portable executables from **[Releases](https://github.com/MaksVolkov7863/Compositor/releases)**!
> 
> Maintained by [@MaksVolkov7863](https://github.com/MaksVolkov7863). Features full cross-platform compatibility with macOS `.comp` projects up to **Manifest Version 9** (supporting formats 1–9 seamlessly).

---

Adobe Photoshop costs too much and tools like GIMP don’t feel familiar enough for me to stay in flow. That’s why Compositor was built.

The goal is a full-featured, lightweight image editor that is completely free and open source — built around the compositing and post-processing workflow needed to create a pixel-perfect final image.

---

## 🪟 Windows Edition Quick Start

- **Download**: Grab `Compositor.Setup.1.0.0.exe` (Installer) or `Compositor.1.0.0.exe` (Portable) from **[GitHub Releases](https://github.com/MaksVolkov7863/Compositor/releases)**.
- **Project Format**: Fully compatible with macOS Compositor `.comp` project files up to Manifest Version 9.
- **Local Dev**:
  ```bash
  cd windows
  npm install
  npm start
  ```
- **Build Windows Executable**:
  ```bash
  cd windows
  npm run dist
  ```

---

## Features

### Layers
- Layers and folders, with blend modes and opacity — a folder's opacity dims everything inside it
- Layer masks: paint, fill, invert, blur and feather them; link or unlink them to transform a mask on its own
- Clipping masks and folder masks
- Adjustment layers: Hue/Saturation, Levels, Curves, Exposure, Gradient Map and Grain
- Layer effects: Stroke, Drop Shadow, Color Overlay, Inner Shadow and Outer Glow, rendered on the GPU and editable at any time
- Merge Down, Merge Layers and Merge Group (⌘E)
- Duplicate, rename inline, reorder and nest by drag and drop; Option-drag to duplicate
- Drag layers between open projects

### Transform
- Non-destructive move, scale, rotate and flip — images keep their full resolution however small you make them
- Free distort (⌘-drag a handle), with Shift to lock to an axis
- Transform several layers, or a whole folder, together
- Snapping to canvas and layer edges and centers, with guides
- Exact values for position, size, scale and angle, stepped with the arrow keys
- Flip Layer and Flip Canvas, horizontal and vertical

### Selections
- Rectangle and Ellipse Marquee, Freehand and Polygonal Lasso, and the Magic tool — Wand selects by color, Object traces whatever you click (Tab switches)
- Select Subject, and Expand, Contract and Feather on any selection
- Add to and subtract from selections, move the outline, or move and duplicate the pixels inside
- Load a layer's pixels or a mask as a selection
- Content-Aware Fill, which can also extend an image past its edges

### Painting and retouching
- Brush with size, hardness, opacity and smoothing, in Paint or Erase mode (B and E), and Shift for straight lines
- Spot Healing Brush (content-aware)
- Clone Stamp, aligned or not, sampling one layer or all of them
- Blur tool, on pixels or masks
- Gradient tool and Shape tool (rectangles, rounded rectangles, ellipses and lines), which stay editable rather than being rasterized
- Type tool (T): inline multiline editing in draggable, resizable paragraph boxes; font, size, color, alignment and spacing in the tool header; transform text and use it as a clipping mask
- Eyedropper and a full color picker

### Adjustments and filters
- Levels (with Auto), Curves, Hue/Saturation, Exposure, Gradient Map, Grain and Invert
- Gaussian Blur and Motion Blur that spread past a layer's edges
- Add Noise, Lens Correction and Remove Background
- Live previews, limited to the selection when there is one

### Canvas and files
- Multiple projects in tabs
- Rulers (⌘R), guides dragged from them, a layout grid, and Snap To for guides, grid, layers and document bounds
- Crop with snapping, and Option for symmetric cropping
- Canvas Size and Image Size
- Sharp high-quality downsampling when zoomed out, and a pixel grid when zoomed in
- Import JPEG, PNG, HEIC, TIFF and Photoshop PSD (8-bit RGB only; not PSB or CMYK). PSD folders, masks, a subset of blend modes, and fill rectangles/ellipses stay editable; text and other vectors become pixels. A conversion report is shown before anything is applied.
- Export JPEG with a live preview (⇧⌥⌘S); Copy Merged
- Photoshop-style keyboard shortcuts throughout, remappable in Edit > Keyboard Shortcuts
- Automatic updates, signed and notarized

## Platforms

### macOS
- macOS 14+ / Xcode 16 or later (to build from source)
- Open `Compositor.xcodeproj` and run the **Compositor** scheme.
- Release DMG build script available in `scripts/release.sh`.

### Windows (Compositor for Windows - Community Edition)
A standalone desktop version with full feature parity for Windows 10 and 11, maintained by [@MaksVolkov7863](https://github.com/MaksVolkov7863):
- **Cross-Platform Compatibility**: Full support for `.comp` project files up to **Manifest Version 9** (including backward compatibility with versions 1–8). Projects saved on macOS open seamlessly in the Windows edition and vice versa.
- **Automated CI/CD Builds**: Continuous builds on GitHub Actions on every push to `main` and tagged releases (`v*`). Ready-to-run setup installers (`.exe`) and portable executables are available from [Releases](https://github.com/MaksVolkov7863/Compositor/releases) and Artifacts.
- **Local Development**:
  ```bash
  cd windows
  npm install
  npm start
  ```
- **Packaging (Windows .exe installer & portable)**:
  ```bash
  cd windows
  npm run dist
  ```

## License

MIT — see [LICENSE](LICENSE).

