#!/usr/bin/env node

/**
 * Compositor Parity Audit Tool
 * 
 * Analyzes parity between macOS upstream Swift test suites (CompositorTests/*.swift)
 * and Windows implementation test suites (windows/tests/*.test.js).
 * 
 * Usage:
 *   node scripts/parity-audit.js [--ci] [--json] [--threshold <percentage>]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SWIFT_TESTS_DIR = path.join(ROOT_DIR, 'CompositorTests');
const WIN_TESTS_DIR = path.join(ROOT_DIR, 'windows', 'tests');

// Explicit mapping and classification of all upstream test suites
const SUITE_MAPPINGS = {
    'AdjustmentLayerTests': { js: 'adjustments-filters.test.js', status: 'synced', desc: 'Adjustment layers (Levels, Curves, Hue/Sat, Invert)' },
    'BlendShortcutTests': { js: 'blend-modes.test.js', status: 'synced', desc: 'Photoshop blend mode cycle shortcuts and math' },
    'BrushIntersectionTests': { js: 'tools-brush.test.js', status: 'synced', desc: 'Brush stroke bounds calculation' },
    'BrushPerformanceTests': { js: 'tools-brush.test.js', status: 'synced', desc: 'Brush rasterization throughput' },
    'BrushTests': { js: 'tools-brush.test.js', status: 'synced', desc: 'Brush engine, spacing, hardness, flow, smoothing' },
    'CameraRawSliderTests': { js: 'camera-raw.test.js', status: 'synced', desc: 'Camera Raw filter slider snapping and limits' },
    'CameraRawTests': { js: 'camera-raw.test.js', status: 'synced', desc: 'Camera Raw color temperature, tint, exposure, highlights' },
    'CanvasEntryTests': { js: 'canvas-size-anchors.test.js', status: 'synced', desc: 'Canvas initialization and aspect ratios' },
    'CanvasSizeTests': { js: 'canvas-size-anchors.test.js', status: 'synced', desc: 'Canvas resize with 9-point anchor positioning' },
    'CanvasThumbnailTests': { js: 'canvas-size-anchors.test.js', status: 'synced', desc: 'Canvas thumbnail generation' },
    'CloneStampTests': { js: 'clone-stamp-healing.test.js', status: 'synced', desc: 'Clone Stamp source sampling and alignment' },
    'ColorPickerTests': { js: 'tools-brush.test.js', status: 'synced', desc: 'Eyedropper tool and RGB/HSV color conversion' },
    'CompositorTests': { js: 'layers.test.js', status: 'synced', desc: 'General document state and active layer tracking' },
    'CropTests': { js: 'image-trim.test.js', status: 'synced', desc: 'Interactive crop and auto-trim transparent pixels' },
    'CursorTests': { js: 'tools-brush.test.js', status: 'partial', desc: 'Crosshair, brush outline and tool cursor shapes' },
    'DistortTests': { js: 'distort.test.js', status: 'synced', desc: 'Free transform, quad distortion, homography perspective' },
    'DownsampleTests': { js: 'transform-canvas.test.js', status: 'partial', desc: 'Mipmapping and downsampling large images' },
    'ExportTests': { js: 'export-formats.test.js', status: 'synced', desc: 'PNG, JPEG, WebP and TIFF export pipelines' },
    'FilterTests': { js: 'adjustments-filters.test.js', status: 'synced', desc: 'Gaussian blur, Motion blur, Film Grain scaling' },
    'FloatingPanelTests': { js: 'layers.test.js', status: 'partial', desc: 'UI floating panels and inspector positioning' },
    'GradientTests': { js: 'vector-shapes.test.js', status: 'synced', desc: 'Linear and radial gradient rasterization' },
    'GroupTests': { js: 'layer-groups.test.js', status: 'synced', desc: 'Folder hierarchy, nesting, group opacity cascading' },
    'GroupingSelectionTests': { js: 'layer-groups.test.js', status: 'synced', desc: 'Multi-layer group creation and drag-into-group' },
    'GuideTests': { js: 'guides-snapping.test.js', status: 'synced', desc: 'Horizontal/vertical guides and smart snapping' },
    'HistoryTests': { js: 'history.test.js', status: 'synced', desc: 'Undo/redo stack, state coalescing and limits' },
    'HueSaturationTests': { js: 'adjustments-filters.test.js', status: 'synced', desc: 'Hue, Saturation, Lightness shifts with HSV wraps' },
    'ImageAdjustmentTests': { js: 'adjustments-filters.test.js', status: 'synced', desc: 'Brightness, Contrast, Exposure, Invert' },
    'ImageImportTests': { js: 'project-format.test.js', status: 'synced', desc: 'Drag-and-drop raster image import and placement' },
    'ImageSizeTests': { js: 'canvas-size-anchors.test.js', status: 'synced', desc: 'Resampling with bilinear and nearest neighbor' },
    'ImageTrimTests': { js: 'image-trim.test.js', status: 'synced', desc: 'Transparent pixels bounding box trimming' },
    'InnerGlowTests': { js: 'inner-glow-effects.test.js', status: 'synced', desc: 'Inner Glow choke, size, source center/edge and blend' },
    'JPEGExportTests': { js: 'export-formats.test.js', status: 'synced', desc: 'JPEG compression quality presets' },
    'LayerAppearanceTests': { js: 'inner-glow-effects.test.js', status: 'synced', desc: 'Layer FX styling pipeline' },
    'LayerMaskTests': { js: 'masks-clipping.test.js', status: 'synced', desc: 'Raster masks, white reveals, black conceals' },
    'LayerTests': { js: 'layers.test.js', status: 'synced', desc: 'Layer creation, duplication, deletion, reordering' },
    'LevelsTests': { js: 'levels.test.js', status: 'synced', desc: 'Levels histogram, black point, white point, gamma' },
    'LiveMaskTests': { js: 'masks-clipping.test.js', status: 'synced', desc: 'Soft base alpha clipping without black fringing' },
    'MagicWandTests': { js: 'selection.test.js', status: 'synced', desc: 'Flood fill selection with tolerance and contiguous check' },
    'MaskTransformTests': { js: 'masks-clipping.test.js', status: 'synced', desc: 'Transforming mask linked or independent from layer' },
    'OuterGlowTests': { js: 'outer-glow-effects.test.js', status: 'synced', desc: 'Outer Glow spread, size, color and blend modes' },
    'PSDFixture': { js: null, status: 'helper', desc: 'Test fixtures for PSD parsing' },
    'PSDRoundTripTests': { js: null, status: 'missing', desc: 'Native PSD binary layer round-trip parsing' },
    'PSDVectorFixtures': { js: null, status: 'helper', desc: 'Vector shape PSD fixtures' },
    'ProjectTests': { js: 'project-format.test.js', status: 'synced', desc: 'Native .comp package saving and loading' },
    'ProjectWorkspaceTests': { js: 'project-format.test.js', status: 'synced', desc: 'Workspace state restoration on document reopen' },
    'RasterSnapshotTests': { js: 'visual-regression.test.js', status: 'synced', desc: 'Deterministic pixel buffer visual comparison' },
    'SelectionClipboardTests': { js: 'selection-clipboard-feather.test.js', status: 'synced', desc: 'Copy/paste bounded by active selection mask' },
    'SelectionEditTests': { js: 'selection.test.js', status: 'synced', desc: 'Selection add, subtract, intersect modes' },
    'SelectionFeatherTests': { js: 'selection-clipboard-feather.test.js', status: 'synced', desc: 'Selection edge feathering Gaussian algorithm' },
    'SelectionTests': { js: 'selection.test.js', status: 'synced', desc: 'Rectangular and elliptical marquee selections' },
    'ShapeToolTests': { js: 'vector-shapes.test.js', status: 'synced', desc: 'Vector rectangles, rounded corners, ellipses' },
    'SliderSnapTests': { js: 'camera-raw.test.js', status: 'synced', desc: 'Adjustment slider zero-snap ergonomics' },
    'SmartEditTests': { js: null, status: 'missing', desc: 'Non-destructive smart filter object pipeline' },
    'SpotHealingTests': { js: 'clone-stamp-healing.test.js', status: 'synced', desc: 'Patch match texture synthesis healing brush' },
    'TiledLayerTests': { js: null, status: 'missing', desc: 'Metal sparse tiled texture allocation' },
    'TransformPressTests': { js: 'transform-canvas.test.js', status: 'synced', desc: 'Interactive transform handle dragging and constraints' },
    'TransformTests': { js: 'transform-canvas.test.js', status: 'synced', desc: 'Affine transforms: rotate, scale, flip, translate' },
    'TypeToolTests': { js: 'type-tool.test.js', status: 'synced', desc: 'Text typography, font size, tracking, alignment' }
};

function main() {
    const args = process.argv.slice(2);
    const isCI = args.includes('--ci');
    const isJSON = args.includes('--json');
    const thresholdIdx = args.indexOf('--threshold');
    const threshold = thresholdIdx !== -1 ? parseFloat(args[thresholdIdx + 1]) : null;

    // Discover actual Swift tests
    let swiftFiles = [];
    if (fs.existsSync(SWIFT_TESTS_DIR)) {
        swiftFiles = fs.readdirSync(SWIFT_TESTS_DIR)
            .filter(f => f.endsWith('.swift'))
            .map(f => f.replace('.swift', ''));
    }

    // Discover actual JS tests
    let jsFiles = [];
    if (fs.existsSync(WIN_TESTS_DIR)) {
        jsFiles = fs.readdirSync(WIN_TESTS_DIR)
            .filter(f => f.endsWith('.test.js'));
    }

    const report = [];
    let syncedCount = 0;
    let partialCount = 0;
    let missingCount = 0;
    let helperCount = 0;

    for (const swiftSuite of swiftFiles) {
        const mapping = SUITE_MAPPINGS[swiftSuite] || {
            js: null,
            status: 'missing',
            desc: 'New unmapped upstream test suite'
        };

        const status = mapping.status;
        if (status === 'synced') syncedCount++;
        else if (status === 'partial') partialCount++;
        else if (status === 'helper') helperCount++;
        else missingCount++;

        report.push({
            swift: swiftSuite,
            js: mapping.js || '—',
            status: status,
            desc: mapping.desc
        });
    }

    const totalAudited = swiftFiles.length - helperCount;
    const parityPercent = totalAudited > 0
        ? Math.round(((syncedCount + partialCount * 0.5) / totalAudited) * 100)
        : 100;

    if (isJSON) {
        console.log(JSON.stringify({
            parityPercent,
            syncedCount,
            partialCount,
            missingCount,
            totalAudited,
            totalSwiftSuites: swiftFiles.length,
            totalJsSuites: jsFiles.length,
            report
        }, null, 2));
        return;
    }

    if (isCI) {
        // Output GitHub Actions Job Summary Markdown
        const summary = [
            `## 🚀 Compositor Upstream Parity Audit`,
            ``,
            `| Metric | Value |`,
            `| --- | --- |`,
            `| **Overall Parity Score** | **${parityPercent}%** |`,
            `| Upstream Swift Suites | ${swiftFiles.length} (${totalAudited} actionable) |`,
            `| Windows JS Test Suites | ${jsFiles.length} |`,
            `| Fully Synced [x] | ${syncedCount} |`,
            `| Partially Synced [~] | ${partialCount} |`,
            `| Missing [ ] | ${missingCount} |`,
            ``,
            `### Test Suites Parity Matrix`,
            ``,
            `| Status | Swift Suite (macOS) | Windows Test (JS) | Description |`,
            `| :---: | :--- | :--- | :--- |`,
            ...report.map(r => {
                const icon = r.status === 'synced' ? '✅' : (r.status === 'partial' ? '🟡' : (r.status === 'helper' ? 'ℹ️' : '❌'));
                return `| ${icon} | \`${r.swift}\` | \`${r.js}\` | ${r.desc} |`;
            }),
            ``
        ].join('\n');

        const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
        if (stepSummaryFile) {
            fs.appendFileSync(stepSummaryFile, summary + '\n');
        }
        console.log(summary);
    } else {
        // CLI terminal output
        console.log('\n======================================================');
        console.log('       COMPOSITOR UPSTREAM PARITY AUDIT               ');
        console.log('======================================================\n');
        console.log(`Actionable Swift Suites: ${totalAudited}`);
        console.log(`Windows JS Suites:       ${jsFiles.length}`);
        console.log(`Synced: [x] ${syncedCount} | Partial: [~] ${partialCount} | Missing: [ ] ${missingCount}`);
        console.log(`Overall Feature Parity:  ${parityPercent}%\n`);

        console.log('Status  Swift Suite (macOS)       Windows JS Suite             Description');
        console.log('--------------------------------------------------------------------------------------');
        for (const r of report) {
            const tag = r.status === 'synced' ? '[x] SYNC ' : (r.status === 'partial' ? '[~] PART ' : (r.status === 'helper' ? '[i] HELP ' : '[ ] MISS '));
            const swiftPad = r.swift.padEnd(25);
            const jsPad = r.js.padEnd(28);
            console.log(`${tag} ${swiftPad} ${jsPad} ${r.desc}`);
        }
        console.log('--------------------------------------------------------------------------------------\n');
    }

    if (threshold !== null && parityPercent < threshold) {
        console.error(`Error: Parity score ${parityPercent}% is below threshold ${threshold}%!`);
        process.exit(1);
    }
}

main();
