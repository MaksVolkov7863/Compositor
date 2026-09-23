/**
 * Compositor Engine for Windows
 * Comprehensive Canvas, Layer, Tool, Adjustment & Selection Pipeline
 */

// Headless mock canvas implementation for Node.js CI test automation
function createMockCanvas(w, h) {
    w = Math.max(1, Math.round(w || 1));
    h = Math.max(1, Math.round(h || 1));
    const bufW = Math.min(w, 4096);
    const bufH = Math.min(h, 4096);
    const buffer = new Uint8ClampedArray(bufW * bufH * 4);

    const parseColor = (str) => {
        if (!str) return { r: 255, g: 255, b: 255, a: 255 };
        if (typeof str === 'object' && str !== null) {
            if (str.stops && str.stops.length > 0) {
                return parseColor(str.stops[0].color);
            }
            return { r: 255, g: 255, b: 255, a: 255 };
        }
        if (typeof str !== 'string') return { r: 255, g: 255, b: 255, a: 255 };
        str = str.trim().toLowerCase();
        const namedColors = {
            black: { r: 0, g: 0, b: 0, a: 255 },
            white: { r: 255, g: 255, b: 255, a: 255 },
            transparent: { r: 0, g: 0, b: 0, a: 0 },
            red: { r: 255, g: 0, b: 0, a: 255 },
            green: { r: 0, g: 255, b: 0, a: 255 },
            blue: { r: 0, g: 0, b: 255, a: 255 },
            yellow: { r: 255, g: 255, b: 0, a: 255 },
            cyan: { r: 0, g: 255, b: 255, a: 255 },
            magenta: { r: 255, g: 0, b: 255, a: 255 }
        };
        if (namedColors[str]) return { ...namedColors[str] };
        if (str.startsWith('#')) {
            let hex = str.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length === 6) {
                const num = parseInt(hex, 16);
                return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 255 };
            } else if (hex.length === 8) {
                const num = parseInt(hex, 16);
                return { r: (num >> 24) & 255, g: (num >> 16) & 255, b: (num >> 8) & 255, a: num & 255 };
            }
        }
        const m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
        if (m) {
            return {
                r: parseInt(m[1]),
                g: parseInt(m[2]),
                b: parseInt(m[3]),
                a: m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255
            };
        }
        return { r: 255, g: 255, b: 255, a: 255 };
    };

    let currentPath = null;
    const ctxObj = {
        fillStyle: '#000000',
        strokeStyle: '#000000',
        globalAlpha: 1.0,
        globalCompositeOperation: 'source-over',
        filter: 'none',
        font: '16px Segoe UI',
        textAlign: 'left',
        textBaseline: 'top',
        lineWidth: 1,
        lineDashOffset: 0,

        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        setLineDash: () => {},

        fillRect: (x, y, rw, rh) => {
            let rx = Math.floor(x);
            let ry = Math.floor(y);
            let rwidth = Math.ceil(rw);
            let rheight = Math.ceil(rh);
            if (rwidth < 0) { rx += rwidth; rwidth = -rwidth; }
            if (rheight < 0) { ry += rheight; rheight = -rheight; }

            const col = parseColor(ctxObj.fillStyle);
            const alpha = Math.round(col.a * ctxObj.globalAlpha);

            for (let py = Math.max(0, ry); py < Math.min(bufH, ry + rheight); py++) {
                for (let px = Math.max(0, rx); px < Math.min(bufW, rx + rwidth); px++) {
                    const idx = (py * bufW + px) * 4;
                    if (ctxObj.globalCompositeOperation === 'destination-out') {
                        const factor = 1 - (col.a / 255) * ctxObj.globalAlpha;
                        buffer[idx + 3] = Math.round(buffer[idx + 3] * factor);
                    } else {
                        buffer[idx] = col.r;
                        buffer[idx + 1] = col.g;
                        buffer[idx + 2] = col.b;
                        buffer[idx + 3] = alpha;
                    }
                }
            }
        },

        clearRect: (x, y, rw, rh) => {
            let rx = Math.floor(x);
            let ry = Math.floor(y);
            let rwidth = Math.ceil(rw);
            let rheight = Math.ceil(rh);
            if (rwidth < 0) { rx += rwidth; rwidth = -rwidth; }
            if (rheight < 0) { ry += rheight; rheight = -rheight; }

            for (let py = Math.max(0, ry); py < Math.min(bufH, ry + rheight); py++) {
                for (let px = Math.max(0, rx); px < Math.min(bufW, rx + rwidth); px++) {
                    const idx = (py * bufW + px) * 4;
                    buffer[idx] = 0; buffer[idx + 1] = 0; buffer[idx + 2] = 0; buffer[idx + 3] = 0;
                }
            }
        },

        beginPath: () => { currentPath = null; },
        rect: (x, y, rw, rh) => { currentPath = { type: 'rect', x, y, rw, rh }; },
        roundRect: (x, y, rw, rh, rad = 0) => { currentPath = { type: 'roundRect', x, y, rw, rh, rad }; },
        ellipse: (cx, cy, rx, ry) => { currentPath = { type: 'ellipse', cx, cy, rx, ry }; },
        arc: (cx, cy, r) => { currentPath = { type: 'ellipse', cx, cy, rx: r, ry: r }; },
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},

        fill: () => {
            if (!currentPath) return;
            const col = parseColor(ctxObj.fillStyle);
            const alpha = Math.round(col.a * ctxObj.globalAlpha);
            const isDestOut = ctxObj.globalCompositeOperation === 'destination-out';

            if (currentPath.type === 'rect') {
                ctxObj.fillRect(currentPath.x, currentPath.y, currentPath.rw, currentPath.rh);
            } else if (currentPath.type === 'roundRect') {
                const { x, y, rw, rh, rad } = currentPath;
                const r = Math.min(rad, Math.min(rw, rh) / 2);
                for (let py = Math.max(0, Math.floor(y)); py < Math.min(bufH, Math.ceil(y + rh)); py++) {
                    for (let px = Math.max(0, Math.floor(x)); px < Math.min(bufW, Math.ceil(x + rw)); px++) {
                        let inCorner = false;
                        let cornerDx = 0, cornerDy = 0;
                        if (px < x + r && py < y + r) { inCorner = true; cornerDx = px - (x + r); cornerDy = py - (y + r); }
                        else if (px > x + rw - r && py < y + r) { inCorner = true; cornerDx = px - (x + rw - r); cornerDy = py - (y + r); }
                        else if (px < x + r && py > y + rh - r) { inCorner = true; cornerDx = px - (x + r); cornerDy = py - (y + rh - r); }
                        else if (px > x + rw - r && py > y + rh - r) { inCorner = true; cornerDx = px - (x + rw - r); cornerDy = py - (y + rh - r); }

                        if (inCorner && (cornerDx * cornerDx + cornerDy * cornerDy > r * r)) {
                            continue;
                        }
                        const idx = (py * bufW + px) * 4;
                        if (isDestOut) {
                            buffer[idx + 3] = Math.round(buffer[idx + 3] * (1 - alpha / 255));
                        } else {
                            buffer[idx] = col.r; buffer[idx + 1] = col.g; buffer[idx + 2] = col.b; buffer[idx + 3] = alpha;
                        }
                    }
                }
            } else if (currentPath.type === 'ellipse') {
                const { cx, cy, rx, ry } = currentPath;
                for (let py = Math.max(0, Math.floor(cy - ry)); py <= Math.min(bufH - 1, Math.ceil(cy + ry)); py++) {
                    for (let px = Math.max(0, Math.floor(cx - rx)); px <= Math.min(bufW - 1, Math.ceil(cx + rx)); px++) {
                        const normX = (px - cx) / Math.max(1, rx);
                        const normY = (py - cy) / Math.max(1, ry);
                        if (normX * normX + normY * normY <= 1.0) {
                            const idx = (py * bufW + px) * 4;
                            if (isDestOut) {
                                buffer[idx + 3] = Math.round(buffer[idx + 3] * (1 - alpha / 255));
                            } else {
                                buffer[idx] = col.r; buffer[idx + 1] = col.g; buffer[idx + 2] = col.b; buffer[idx + 3] = alpha;
                            }
                        }
                    }
                }
            }
        },

        stroke: () => {
            if (!currentPath) return;
            const col = parseColor(ctxObj.strokeStyle);
            const alpha = Math.round(col.a * ctxObj.globalAlpha);
            if (currentPath.type === 'rect') {
                const { x, y, rw, rh } = currentPath;
                const lw = Math.max(1, Math.round(ctxObj.lineWidth || 1));
                ctxObj.fillRect(x, y, rw, lw);
                ctxObj.fillRect(x, y + rh - lw, rw, lw);
                ctxObj.fillRect(x, y, lw, rh);
                ctxObj.fillRect(x + rw - lw, y, lw, rh);
            }
        },

        clip: () => {},

        fillText: (text, x, y) => {
            const col = parseColor(ctxObj.fillStyle);
            const alpha = Math.round(col.a * ctxObj.globalAlpha);
            const tw = Math.max(10, Math.min(bufW - x, (text ? text.length : 1) * 12));
            const th = 16;
            for (let py = Math.max(0, Math.floor(y)); py < Math.min(bufH, Math.ceil(y + th)); py++) {
                for (let px = Math.max(0, Math.floor(x)); px < Math.min(bufW, Math.ceil(x + tw)); px++) {
                    const idx = (py * bufW + px) * 4;
                    buffer[idx] = col.r; buffer[idx + 1] = col.g; buffer[idx + 2] = col.b; buffer[idx + 3] = alpha;
                }
            }
        },

        strokeText: () => {},
        measureText: (text) => ({ width: (text ? text.length : 0) * 12, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }),

        createLinearGradient: () => {
            const stops = [];
            return {
                stops,
                addColorStop: (pos, color) => { stops.push({ pos, color }); }
            };
        },

        createRadialGradient: () => {
            const stops = [];
            return {
                stops,
                addColorStop: (pos, color) => { stops.push({ pos, color }); }
            };
        },

        getImageData: (x = 0, y = 0, gw = w, gh = h) => {
            const clampedW = Math.min(Math.max(1, gw), bufW);
            const clampedH = Math.min(Math.max(1, gh), bufH);
            const sub = new Uint8ClampedArray(clampedW * clampedH * 4);
            for (let py = 0; py < clampedH; py++) {
                for (let px = 0; px < clampedW; px++) {
                    const srcX = x + px;
                    const srcY = y + py;
                    const dstIdx = (py * clampedW + px) * 4;
                    if (srcX >= 0 && srcX < bufW && srcY >= 0 && srcY < bufH) {
                        const srcIdx = (srcY * bufW + srcX) * 4;
                        sub[dstIdx] = buffer[srcIdx];
                        sub[dstIdx + 1] = buffer[srcIdx + 1];
                        sub[dstIdx + 2] = buffer[srcIdx + 2];
                        sub[dstIdx + 3] = buffer[srcIdx + 3];
                    }
                }
            }
            return { data: sub, width: clampedW, height: clampedH };
        },

        putImageData: (imgData, x = 0, y = 0) => {
            if (!imgData || !imgData.data) return;
            const iw = imgData.width || 0;
            const ih = imgData.height || 0;
            for (let py = 0; py < ih; py++) {
                for (let px = 0; px < iw; px++) {
                    const dstX = x + px;
                    const dstY = y + py;
                    if (dstX >= 0 && dstX < bufW && dstY >= 0 && dstY < bufH) {
                        const srcIdx = (py * iw + px) * 4;
                        const dstIdx = (dstY * bufW + dstX) * 4;
                        buffer[dstIdx] = imgData.data[srcIdx];
                        buffer[dstIdx + 1] = imgData.data[srcIdx + 1];
                        buffer[dstIdx + 2] = imgData.data[srcIdx + 2];
                        buffer[dstIdx + 3] = imgData.data[srcIdx + 3];
                    }
                }
            }
        },

        drawImage: (src, ...args) => {
            if (!src) return;
            let sdata = null, sw = 0, sh = 0;
            if (src.getContext) {
                const sctx = src.getContext('2d');
                sw = src.width;
                sh = src.height;
                const safeW = Math.min(sw, 4096);
                const safeH = Math.min(sh, 4096);
                sdata = sctx.getImageData(0, 0, safeW, safeH).data;
                sw = safeW;
                sh = safeH;
            } else if (src.data) {
                sw = src.width;
                sh = src.height;
                sdata = src.data;
            }
            if (!sdata) return;

            let dx = 0, dy = 0, dw = sw, dh = sh;
            if (args.length === 2) {
                [dx, dy] = args;
            } else if (args.length === 4) {
                [dx, dy, dw, dh] = args;
            } else if (args.length >= 8) {
                dx = args[4]; dy = args[5]; dw = args[6]; dh = args[7];
            }

            const isDestIn = ctxObj.globalCompositeOperation === 'destination-in';
            const isDestOut = ctxObj.globalCompositeOperation === 'destination-out';
            const alpha = ctxObj.globalAlpha !== undefined ? ctxObj.globalAlpha : 1.0;

            for (let py = 0; py < dh; py++) {
                for (let px = 0; px < dw; px++) {
                    const dstX = Math.floor(dx + px);
                    const dstY = Math.floor(dy + py);
                    if (dstX < 0 || dstX >= bufW || dstY < 0 || dstY >= bufH) continue;

                    const srcX = Math.floor((px / dw) * sw);
                    const srcY = Math.floor((py / dh) * sh);
                    if (srcX < 0 || srcX >= sw || srcY < 0 || srcY >= sh) continue;

                    const sIdx = (srcY * sw + srcX) * 4;
                    const dIdx = (dstY * bufW + dstX) * 4;

                    if (isDestIn) {
                        const srcAlpha = (sdata[sIdx + 3] / 255) * (sdata[sIdx] / 255) * alpha;
                        buffer[dIdx + 3] = Math.round(buffer[dIdx + 3] * srcAlpha);
                    } else if (isDestOut) {
                        const srcAlpha = (sdata[sIdx + 3] / 255) * alpha;
                        buffer[dIdx + 3] = Math.round(buffer[dIdx + 3] * (1 - srcAlpha));
                    } else {
                        const srcA = (sdata[sIdx + 3] / 255) * alpha;
                        if (srcA <= 0) continue;
                        if (srcA >= 1) {
                            buffer[dIdx] = sdata[sIdx];
                            buffer[dIdx + 1] = sdata[sIdx + 1];
                            buffer[dIdx + 2] = sdata[sIdx + 2];
                            buffer[dIdx + 3] = 255;
                        } else {
                            const dstA = buffer[dIdx + 3] / 255;
                            const outA = srcA + dstA * (1 - srcA);
                            if (outA > 0) {
                                buffer[dIdx] = Math.round((sdata[sIdx] * srcA + buffer[dIdx] * dstA * (1 - srcA)) / outA);
                                buffer[dIdx + 1] = Math.round((sdata[sIdx + 1] * srcA + buffer[dIdx + 1] * dstA * (1 - srcA)) / outA);
                                buffer[dIdx + 2] = Math.round((sdata[sIdx + 2] * srcA + buffer[dIdx + 2] * dstA * (1 - srcA)) / outA);
                                buffer[dIdx + 3] = Math.round(outA * 255);
                            }
                        }
                    }
                }
            }
        }
    };

    return {
        width: w,
        height: h,
        getContext: () => ctxObj,
        toDataURL: (format = 'image/png') => `data:${format};base64,mock`,
        toBlob: (cb, type = 'image/png') => { if (cb) cb({ size: buffer.length, type }); }
    };
}

if (typeof document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => {
            if (tag === 'canvas') {
                return createMockCanvas(800, 600);
            }
            return {};
        }
    };
}
if (typeof window === 'undefined') {
    globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
}
if (typeof requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = () => {};
}
if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class {
        rect() {}
        ellipse() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        addPath() {}
    };
}

class CompositorEngine {
    constructor(canvasElement, overlayElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
        this.overlay = overlayElement;
        this.overlayCtx = overlayElement.getContext('2d');

        // Document Properties
        this.width = 1200;
        this.height = 800;
        this.resolution = 72;
        this.layers = [];
        this.activeLayerId = null;

        // Viewport / Navigation
        this.viewport = {
            zoom: 1.0,
            panX: 0,
            panY: 0
        };

        // Tools
        this.currentTool = 'move'; // move, marquee, lasso, wand, crop, eyedropper, heal, brush, eraser, gradient, blur, type, shape, hand, zoom
        this.toolSettings = {
            brush: { size: 30, hardness: 80, opacity: 100, smoothing: 0 },
            eraser: { size: 30, hardness: 80, opacity: 100 },
            cloneStamp: { size: 40, hardness: 0, opacity: 100 },
            spotHealing: { size: 24, hardness: 100, opacity: 100 },
            marquee: { type: 'rect', feather: 0 },
            lasso: { type: 'freehand' },
            wand: { tolerance: 32, contiguous: true },
            gradient: { type: 'linear' },
            shape: { type: 'rectangle', fill: true, stroke: false, strokeWidth: 2, radius: 10 },
            type: { text: 'Compositor', font: 'Segoe UI', size: 48, bold: false, italic: false },
            crop: { aspect: 'free' }
        };
        this.cloneSettings = { aligned: true };
        this.spotHealingMode = 'proximity';
        this.clipboard = null;
        this.shapeLayerCounter = 1;
        this.textLayerCounter = 1;

        // Palette
        this.foregroundColor = '#ffffff';
        this.backgroundColor = '#000000';

        // Selection
        this.selection = null; // { mask: Uint8Array, width, height, bounds: {x0, y0, x1, y1} }
        this.selectionPath = null;
        this.selectionOffset = 0; // for marching ants

        // Guides and Snapping
        this.guides = { horizontal: [], vertical: [] };
        this.locksGuides = false;
        this.showRulers = true;
        this.showGuides = true;
        this.showGrid = false;
        this.snapEnabled = true;
        this.snapToDocumentBounds = true;
        this.snapToLayers = true;
        this.snapToGuides = true;
        this.snapToGrid = false;

        // History
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 40;

        // Interactive states
        this.isInteracting = false;
        this.lastPointer = { x: 0, y: 0 };
        this.samplePoint = null; // for clone stamp / healing
        this.cropBox = null;
        this.transformBox = null;

        // Callbacks for UI updates
        this.onLayerListChange = null;
        this.onActiveLayerChange = null;
        this.onHistoryChange = null;
        this.onColorChange = null;
        this.onStatusChange = null;
        this.onZoomChange = null;

        this.init();
    }

    init() {
        this.newCanvas(1200, 800, '#ffffff');
        this.startMarchingAntsLoop();
    }

    // --- Document & Layers ---

    newCanvas(width, height, background = '#ffffff') {
        this.width = Math.max(1, Math.min(width, 50000));
        this.height = Math.max(1, Math.min(height, 50000));
        this.layers = [];
        this.selection = null;
        this.history = [];
        this.historyIndex = -1;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.overlay.width = this.width;
        this.overlay.height = this.height;

        // Create Background Layer
        const bgLayer = this.createLayer('Background', this.width, this.height);
        if (background !== 'transparent') {
            bgLayer.ctx.fillStyle = background;
            bgLayer.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.layers.push(bgLayer);
        this.activeLayerId = bgLayer.id;

        this.recordHistory('New Canvas');
        this.fitToScreen();
        this.render();
        this.notifyUI();
    }

    createLayer(name = 'New Layer', w = this.width, h = this.height) {
        const id = 'layer_' + Math.random().toString(36).substring(2, 11);
        const canvas = this.createCanvas(w, h);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        return {
            id,
            name,
            visible: true,
            opacity: 1.0,
            blendMode: 'Normal',
            x: 0,
            y: 0,
            width: w,
            height: h,
            rotation: 0,
            flipX: false,
            flipY: false,
            canvas,
            ctx,
            hasMask: false,
            maskCanvas: null,
            maskCtx: null,
            maskEnabled: true,
            maskSourceId: null, // clipping mask
            isGroup: false,
            parentId: null
        };
    }

    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId) || null;
    }

    addLayer(name = 'Layer') {
        const newLayer = this.createLayer(name, this.width, this.height);
        const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (activeIdx !== -1) {
            this.layers.splice(activeIdx + 1, 0, newLayer);
        } else {
            this.layers.push(newLayer);
        }
        this.activeLayerId = newLayer.id;
        this.recordHistory('Add Layer');
        this.render();
        this.notifyUI();
        return newLayer;
    }

    duplicateLayer() {
        const active = this.getActiveLayer();
        if (!active) return;
        const dup = this.createLayer(active.name + ' copy', active.width, active.height);
        dup.ctx.drawImage(active.canvas, 0, 0);
        dup.opacity = active.opacity;
        dup.blendMode = active.blendMode;
        dup.x = active.x;
        dup.y = active.y;
        dup.rotation = active.rotation;
        dup.flipX = active.flipX;
        dup.flipY = active.flipY;
        if (active.liveText) dup.liveText = JSON.parse(JSON.stringify(active.liveText));
        if (active.shapeType) {
            dup.shapeType = active.shapeType;
            dup.shapeCornerRadius = active.shapeCornerRadius;
        }
        if (active.effects) dup.effects = JSON.parse(JSON.stringify(active.effects));
        if (active.hasMask && active.maskCanvas) {
            this.addMaskToLayer(dup);
            dup.maskCtx.drawImage(active.maskCanvas, 0, 0);
            dup.maskEnabled = active.maskEnabled;
        }

        const idx = this.layers.findIndex(l => l.id === active.id);
        this.layers.splice(idx + 1, 0, dup);
        this.activeLayerId = dup.id;
        this.recordHistory('Duplicate Layer');
        this.render();
        this.notifyUI();
    }

    addGroup(name = 'Group') {
        const group = this.createLayer(name, this.width, this.height);
        group.isGroup = true;
        group.collapsed = false;
        const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (activeIdx !== -1) {
            this.layers.splice(activeIdx + 1, 0, group);
        } else {
            this.layers.push(group);
        }
        this.activeLayerId = group.id;
        this.recordHistory('Add Group');
        this.render();
        this.notifyUI();
        return group;
    }

    toggleGroupExpansion(groupId) {
        const group = this.layers.find(l => l.id === groupId);
        if (group && group.isGroup) {
            group.collapsed = !group.collapsed;
            this.notifyUI();
        }
    }

    placeLayer(layerId, inGroupId, atBottom = false) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;
        if (inGroupId) {
            const group = this.layers.find(l => l.id === inGroupId);
            if (!group || !group.isGroup) return false;
            // Prevent placing group into itself or descendants
            if (layer.id === inGroupId) return false;
            let cur = group;
            while (cur && cur.parentId) {
                if (cur.parentId === layer.id) return false;
                cur = this.layers.find(l => l.id === cur.parentId);
            }
        }
        layer.parentId = inGroupId || null;
        this.recordHistory('Move Layer Into Group');
        this.render();
        this.notifyUI();
        return true;
    }

    moveActiveLayerOutOfGroup() {
        const active = this.getActiveLayer();
        if (!active || !active.parentId) return;
        const parent = this.layers.find(l => l.id === active.parentId);
        active.parentId = parent ? (parent.parentId || null) : null;
        this.recordHistory('Move Layer Out of Group');
        this.render();
        this.notifyUI();
    }

    deleteActiveLayer() {
        if (this.layers.length <= 1) return;
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx !== -1) {
            const toDelete = this.layers[idx];
            if (toDelete.isGroup) {
                const childIds = new Set();
                const findChildren = (pid) => {
                    for (const l of this.layers) {
                        if (l.parentId === pid) {
                            childIds.add(l.id);
                            if (l.isGroup) findChildren(l.id);
                        }
                    }
                };
                findChildren(toDelete.id);
                this.layers = this.layers.filter(l => l.id !== toDelete.id && !childIds.has(l.id));
            } else {
                this.layers.splice(idx, 1);
            }
            if (this.layers.length === 0) {
                const base = this.createLayer('Background', this.width, this.height);
                this.layers.push(base);
            }
            const nextIdx = Math.max(0, Math.min(idx, this.layers.length - 1));
            this.activeLayerId = this.layers[nextIdx]?.id || null;
            this.recordHistory('Delete Layer');
            this.render();
            this.notifyUI();
        }
    }

    moveLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) return;
        const item = this.layers.splice(fromIndex, 1)[0];
        this.layers.splice(toIndex, 0, item);
        this.recordHistory('Reorder Layers');
        this.render();
        this.notifyUI();
    }

    mergeLayers() {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx <= 0) return; // Cannot merge bottom layer down
        const upper = this.layers[idx];
        const lower = this.layers[idx - 1];

        const tempCanvas = this.createCanvas(this.width, this.height);
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw lower
        tempCtx.save();
        tempCtx.globalAlpha = lower.opacity;
        tempCtx.globalCompositeOperation = this.mapBlendMode(lower.blendMode);
        tempCtx.drawImage(lower.canvas, lower.x, lower.y);
        tempCtx.restore();

        // Draw upper
        tempCtx.save();
        tempCtx.globalAlpha = upper.opacity;
        tempCtx.globalCompositeOperation = this.mapBlendMode(upper.blendMode);
        tempCtx.drawImage(upper.canvas, upper.x, upper.y);
        tempCtx.restore();

        // Replace lower with merged
        lower.canvas = tempCanvas;
        lower.ctx = tempCtx;
        lower.x = 0;
        lower.y = 0;
        lower.width = this.width;
        lower.height = this.height;

        this.layers.splice(idx, 1);
        this.activeLayerId = lower.id;
        this.recordHistory('Merge Layers');
        this.render();
        this.notifyUI();
    }

    flattenImage() {
        const flatCanvas = this.createCanvas(this.width, this.height);
        flatCanvas.width = this.width;
        flatCanvas.height = this.height;
        const flatCtx = flatCanvas.getContext('2d');
        flatCtx.fillStyle = '#ffffff';
        flatCtx.fillRect(0, 0, this.width, this.height);
        flatCtx.drawImage(this.canvas, 0, 0);

        const baseLayer = this.createLayer('Background', this.width, this.height);
        baseLayer.canvas = flatCanvas;
        baseLayer.ctx = flatCtx;

        this.layers = [baseLayer];
        this.activeLayerId = baseLayer.id;
        this.recordHistory('Flatten Image');
        this.render();
        this.notifyUI();
    }

    addMaskToLayer(layer) {
        if (!layer || layer.hasMask) return;
        layer.hasMask = true;
        layer.maskCanvas = this.createCanvas(layer.width, layer.height);
        layer.maskCanvas.width = layer.width;
        layer.maskCanvas.height = layer.height;
        layer.maskCtx = layer.maskCanvas.getContext('2d', { willReadFrequently: true });
        layer.maskCtx.fillStyle = '#ffffff'; // White reveals
        layer.maskCtx.fillRect(0, 0, layer.width, layer.height);
        layer.maskEnabled = true;
        this.render();
        this.notifyUI();
    }

    toggleClippingMask() {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const idx = this.layers.findIndex(l => l.id === layer.id);
        if (idx <= 0) return; // Cannot clip bottom layer

        if (layer.maskSourceId) {
            layer.maskSourceId = null;
        } else {
            layer.maskSourceId = this.layers[idx - 1].id;
        }
        this.recordHistory('Toggle Clipping Mask');
        this.render();
        this.notifyUI();
    }

    // --- Rendering Pipeline ---

    mapBlendMode(mode) {
        switch (mode) {
            case 'Multiply': return 'multiply';
            case 'Screen': return 'screen';
            case 'Overlay': return 'overlay';
            case 'Darken': return 'darken';
            case 'Lighten': return 'lighten';
            case 'Color Dodge': return 'color-dodge';
            case 'Color Burn': return 'color-burn';
            case 'Difference': return 'difference';
            case 'Exclusion': return 'exclusion';
            case 'Soft Light': return 'soft-light';
            case 'Hard Light': return 'hard-light';
            case 'Hue': return 'hue';
            case 'Saturation': return 'saturation';
            case 'Color': return 'color';
            case 'Luminosity': return 'luminosity';
            default: return 'source-over';
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.visible) continue;
            if (layer.isGroup) continue;

            // Check ancestor group visibility and cascade group opacity
            let cur = layer;
            let ancestorVisible = true;
            let effectiveOpacity = layer.opacity !== undefined ? layer.opacity : 1.0;
            while (cur && cur.parentId) {
                const parent = this.layers.find(l => l.id === cur.parentId);
                if (!parent) break;
                if (!parent.visible) {
                    ancestorVisible = false;
                    break;
                }
                effectiveOpacity *= (parent.opacity !== undefined ? parent.opacity : 1.0);
                cur = parent;
            }
            if (!ancestorVisible) continue;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, Math.min(1, effectiveOpacity));
            this.ctx.globalCompositeOperation = this.mapBlendMode(layer.blendMode);

            // Layer Transformations
            const cx = layer.x + layer.width / 2;
            const cy = layer.y + layer.height / 2;
            this.ctx.translate(cx, cy);
            if (layer.rotation) this.ctx.rotate((layer.rotation * Math.PI) / 180);
            this.ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
            this.ctx.translate(-cx, -cy);

            // Layer Effects: Outer Glow
            if (layer.effects && layer.effects.outerGlow && layer.effects.outerGlow.enabled !== false) {
                const og = layer.effects.outerGlow;
                if (og.size > 0 && og.opacity > 0) {
                    this.ctx.save();
                    const r = Math.round((og.red !== undefined ? og.red : 1) * 255);
                    const g = Math.round((og.green !== undefined ? og.green : 1) * 255);
                    const b = Math.round((og.blue !== undefined ? og.blue : 1) * 255);
                    this.ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${og.opacity})`;
                    this.ctx.shadowBlur = og.size;
                    this.ctx.shadowOffsetX = 0;
                    this.ctx.shadowOffsetY = 0;
                    this.ctx.drawImage(layer.canvas, layer.x, layer.y);
                    this.ctx.restore();
                }
            }

            if (layer.hasMask && layer.maskEnabled && layer.maskCanvas) {
                // Render layer with mask
                const tempCanvas = this.createCanvas(layer.width, layer.height);
                tempCanvas.width = layer.width;
                tempCanvas.height = layer.height;
                const tempCtx = tempCanvas.getContext('2d');

                tempCtx.drawImage(layer.canvas, 0, 0);
                tempCtx.globalCompositeOperation = 'destination-in';
                tempCtx.drawImage(layer.maskCanvas, 0, 0);

                this.ctx.drawImage(tempCanvas, layer.x, layer.y);
            } else {
                this.ctx.drawImage(layer.canvas, layer.x, layer.y);
            }

            // Layer Effects: Inner Glow
            if (layer.effects && layer.effects.innerGlow && layer.effects.innerGlow.enabled !== false) {
                const ig = layer.effects.innerGlow;
                if (ig.size > 0 && ig.opacity > 0) {
                    const igCanvas = this.createCanvas(layer.width, layer.height);
                    igCanvas.width = layer.width;
                    igCanvas.height = layer.height;
                    const igCtx = igCanvas.getContext('2d');

                    const r = Math.round((ig.red !== undefined ? ig.red : 1) * 255);
                    const g = Math.round((ig.green !== undefined ? ig.green : 1) * 255);
                    const b = Math.round((ig.blue !== undefined ? ig.blue : 1) * 255);

                    igCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ig.opacity})`;
                    igCtx.fillRect(0, 0, layer.width, layer.height);

                    igCtx.globalCompositeOperation = 'destination-out';
                    igCtx.filter = `blur(${ig.size}px)`;
                    igCtx.drawImage(layer.canvas, 0, 0);

                    igCtx.filter = 'none';
                    igCtx.globalCompositeOperation = 'destination-in';
                    igCtx.drawImage(layer.canvas, 0, 0);

                    this.ctx.drawImage(igCanvas, layer.x, layer.y);
                }
            }

            this.ctx.restore();
        }

        this.renderOverlay();
    }

    renderOverlay() {
        this.overlayCtx.clearRect(0, 0, this.width, this.height);

        // Marching ants for selection
        if (this.selection && this.selectionPath) {
            this.overlayCtx.save();
            this.overlayCtx.lineWidth = 1;
            this.overlayCtx.lineDashOffset = this.selectionOffset;
            this.overlayCtx.setLineDash([4, 4]);

            this.overlayCtx.strokeStyle = '#000000';
            this.overlayCtx.stroke(this.selectionPath);

            this.overlayCtx.strokeStyle = '#ffffff';
            this.overlayCtx.lineDashOffset = this.selectionOffset + 4;
            this.overlayCtx.stroke(this.selectionPath);
            this.overlayCtx.restore();
        }

        // Transform bounding box
        if (this.currentTool === 'move' && this.transformBox) {
            const b = this.transformBox;
            this.overlayCtx.save();
            this.overlayCtx.strokeStyle = '#0078d4';
            this.overlayCtx.lineWidth = 1.5;
            this.overlayCtx.strokeRect(b.x, b.y, b.width, b.height);

            // Corner & Edge Handles
            const handleSize = 8;
            this.overlayCtx.fillStyle = '#ffffff';
            this.overlayCtx.strokeStyle = '#0078d4';
            const handles = [
                { x: b.x, y: b.y },
                { x: b.x + b.width / 2, y: b.y },
                { x: b.x + b.width, y: b.y },
                { x: b.x + b.width, y: b.y + b.height / 2 },
                { x: b.x + b.width, y: b.y + b.height },
                { x: b.x + b.width / 2, y: b.y + b.height },
                { x: b.x, y: b.y + b.height },
                { x: b.x, y: b.y + b.height / 2 }
            ];

            for (const h of handles) {
                this.overlayCtx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
                this.overlayCtx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
            }
            this.overlayCtx.restore();
        }

        // Crop bounding box
        if (this.currentTool === 'crop' && this.cropBox) {
            const c = this.cropBox;
            this.overlayCtx.save();
            // Dim outside area
            this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            this.overlayCtx.fillRect(0, 0, this.width, c.y);
            this.overlayCtx.fillRect(0, c.y + c.height, this.width, this.height - (c.y + c.height));
            this.overlayCtx.fillRect(0, c.y, c.x, c.height);
            this.overlayCtx.fillRect(c.x + c.width, c.y, this.width - (c.x + c.width), c.height);

            // Rule of thirds grid
            this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.overlayCtx.lineWidth = 1;
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(c.x + c.width / 3, c.y);
            this.overlayCtx.lineTo(c.x + c.width / 3, c.y + c.height);
            this.overlayCtx.moveTo(c.x + (c.width * 2) / 3, c.y);
            this.overlayCtx.lineTo(c.x + (c.width * 2) / 3, c.y + c.height);
            this.overlayCtx.moveTo(c.x, c.y + c.height / 3);
            this.overlayCtx.lineTo(c.x + c.width, c.y + c.height / 3);
            this.overlayCtx.moveTo(c.x, c.y + (c.height * 2) / 3);
            this.overlayCtx.lineTo(c.x + c.width, c.y + (c.height * 2) / 3);
            this.overlayCtx.stroke();

            // Border
            this.overlayCtx.strokeStyle = '#ffffff';
            this.overlayCtx.lineWidth = 1.5;
            this.overlayCtx.strokeRect(c.x, c.y, c.width, c.height);
            this.overlayCtx.restore();
        }

        // Guides
        if (this.showGuides) {
            this.overlayCtx.save();
            this.overlayCtx.strokeStyle = '#00ffff';
            this.overlayCtx.lineWidth = 1;
            for (const h of this.guides.horizontal) {
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(0, h);
                this.overlayCtx.lineTo(this.width, h);
                this.overlayCtx.stroke();
            }
            for (const v of this.guides.vertical) {
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(v, 0);
                this.overlayCtx.lineTo(v, this.height);
                this.overlayCtx.stroke();
            }
            this.overlayCtx.restore();
        }
    }

    startMarchingAntsLoop() {
        if (this.isHeadless || typeof window === 'undefined' || typeof process !== 'undefined') return;
        const loop = () => {
            if (this.selection) {
                this.selectionOffset = (this.selectionOffset + 0.5) % 8;
                this.renderOverlay();
            }
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(loop);
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(loop);
        }
    }

    // --- Interactive Tool Handlers ---

    pointerDown(docX, docY, button = 0, shift = false, alt = false) {
        this.isInteracting = true;
        this.lastPointer = { x: docX, y: docY };

        if (button === 1 || this.currentTool === 'hand') {
            // Middle button or hand tool -> Pan
            return;
        }

        const activeLayer = this.getActiveLayer();

        switch (this.currentTool) {
            case 'move':
                if (alt && activeLayer) {
                    // Alt+drag duplicates layer
                    this.duplicateLayer();
                }
                // Auto-select top layer under cursor if not clicked on active
                this.selectLayerUnderPoint(docX, docY);
                this.updateTransformBox();
                break;

            case 'brush':
                if (activeLayer) {
                    this.drawBrushStroke(docX, docY, false);
                }
                break;

            case 'eraser':
                if (activeLayer) {
                    this.drawBrushStroke(docX, docY, true);
                }
                break;

            case 'eyedropper':
                this.sampleColorAt(docX, docY);
                break;

            case 'heal':
                if (alt) {
                    this.samplePoint = { x: docX, y: docY };
                    this.notifyStatus(`Sample point set to (${Math.round(docX)}, ${Math.round(docY)})`);
                } else if (this.samplePoint && activeLayer) {
                    this.applyCloneStamp(docX, docY);
                }
                break;

            case 'marquee':
                this.dragStart = { x: docX, y: docY };
                break;

            case 'lasso':
                this.lassoPoints = [{ x: docX, y: docY }];
                break;

            case 'wand':
                this.magicWandSelect(docX, docY, this.toolSettings.wand.tolerance, this.toolSettings.wand.contiguous);
                break;

            case 'gradient':
                this.gradientStart = { x: docX, y: docY };
                break;

            case 'shape':
                this.shapeStart = { x: docX, y: docY };
                break;

            case 'crop':
                if (!this.cropBox) {
                    this.cropBox = { x: 0, y: 0, width: this.width, height: this.height };
                }
                this.cropStart = { x: docX, y: docY };
                break;

            case 'type':
                this.placeText(docX, docY);
                break;
        }

        this.render();
    }

    pointerMove(docX, docY, buttons = 1, shift = false, alt = false) {
        if (!this.isInteracting) return;
        const dx = docX - this.lastPointer.x;
        const dy = docY - this.lastPointer.y;

        const activeLayer = this.getActiveLayer();

        switch (this.currentTool) {
            case 'move':
                if (activeLayer) {
                    activeLayer.x += dx;
                    activeLayer.y += dy;
                    this.updateTransformBox();
                    this.render();
                }
                break;

            case 'brush':
                if (activeLayer) {
                    const smoothing = this.toolSettings.brush?.smoothing || 0;
                    let targetX = docX, targetY = docY;
                    if (smoothing > 0) {
                        const factor = 1 - Math.min(0.95, smoothing / 100);
                        targetX = this.lastPointer.x + (docX - this.lastPointer.x) * factor;
                        targetY = this.lastPointer.y + (docY - this.lastPointer.y) * factor;
                    }
                    this.drawBrushLine(this.lastPointer.x, this.lastPointer.y, targetX, targetY, false);
                    this.render();
                    this.lastPointer = { x: targetX, y: targetY };
                    return;
                }
                break;

            case 'eraser':
                if (activeLayer) {
                    this.drawBrushLine(this.lastPointer.x, this.lastPointer.y, docX, docY, true);
                    this.render();
                }
                break;

            case 'heal':
                if (this.samplePoint && activeLayer) {
                    this.applyCloneStamp(docX, docY);
                    this.render();
                }
                break;

            case 'marquee':
                if (this.dragStart) {
                    const x = Math.min(this.dragStart.x, docX);
                    const y = Math.min(this.dragStart.y, docY);
                    let w = Math.abs(docX - this.dragStart.x);
                    let h = Math.abs(docY - this.dragStart.y);
                    if (shift) {
                        const s = Math.max(w, h);
                        w = s;
                        h = s;
                    }
                    this.setRectSelection(x, y, w, h, this.toolSettings.marquee.type === 'ellipse');
                }
                break;

            case 'lasso':
                if (this.lassoPoints) {
                    this.lassoPoints.push({ x: docX, y: docY });
                    this.updateLassoSelection();
                }
                break;
        }

        this.lastPointer = { x: docX, y: docY };
    }

    pointerUp() {
        if (!this.isInteracting) return;
        this.isInteracting = false;

        switch (this.currentTool) {
            case 'brush':
            case 'eraser':
            case 'heal':
                this.recordHistory(this.currentTool.toUpperCase() + ' stroke');
                break;

            case 'move':
                this.recordHistory('Move layer');
                break;

            case 'gradient':
                if (this.gradientStart && this.lastPointer) {
                    this.applyGradient(this.gradientStart.x, this.gradientStart.y, this.lastPointer.x, this.lastPointer.y);
                    this.gradientStart = null;
                }
                break;

            case 'shape':
                if (this.shapeStart && this.lastPointer) {
                    this.drawShape(this.shapeStart.x, this.shapeStart.y, this.lastPointer.x, this.lastPointer.y);
                    this.shapeStart = null;
                }
                break;

            case 'lasso':
                if (this.lassoPoints && this.lassoPoints.length > 2) {
                    this.finalizeLassoSelection();
                    this.lassoPoints = null;
                }
                break;
        }

        this.render();
    }

    // --- Brush & Drawing Algorithms ---

    drawBrushStroke(x, y, isEraser = false) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const ctx = layer.ctx;
        const localX = x - layer.x;
        const localY = y - layer.y;
        const settings = isEraser ? this.toolSettings.eraser : this.toolSettings.brush;

        ctx.save();
        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        const radius = settings.size / 2;
        const opacity = (settings.opacity / 100);

        if (settings.hardness >= 95) {
            ctx.fillStyle = isEraser ? `rgba(0,0,0,${opacity})` : this.foregroundColor;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(localX, localY, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const radGrad = ctx.createRadialGradient(localX, localY, radius * (settings.hardness / 100), localX, localY, radius);
            if (isEraser) {
                radGrad.addColorStop(0, `rgba(0,0,0,${opacity})`);
                radGrad.addColorStop(1, 'rgba(0,0,0,0)');
            } else {
                const color = this.hexToRgb(this.foregroundColor);
                radGrad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${opacity})`);
                radGrad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
            }
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(localX, localY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawBrushLine(x0, y0, x1, y1, isEraser = false) {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const settings = isEraser ? this.toolSettings.eraser : this.toolSettings.brush;
        const step = Math.max(1, settings.size * 0.2);
        const count = Math.ceil(dist / step);

        for (let i = 0; i <= count; i++) {
            const t = count === 0 ? 0 : i / count;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            this.drawBrushStroke(x, y, isEraser);
        }
    }

    applyCloneStamp(docX, docY) {
        const layer = this.getActiveLayer();
        if (!layer || !this.samplePoint) return;
        const offset = { x: docX - this.samplePoint.x, y: docY - this.samplePoint.y };

        const tempCanvas = this.createCanvas(this.width, this.height);
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        const radius = this.toolSettings.brush.size / 2;
        layer.ctx.save();
        layer.ctx.beginPath();
        layer.ctx.arc(docX - layer.x, docY - layer.y, radius, 0, Math.PI * 2);
        layer.ctx.clip();
        layer.ctx.drawImage(tempCanvas, offset.x, offset.y);
        layer.ctx.restore();
    }

    applyGradient(x0, y0, x1, y1) {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const lx0 = x0 - layer.x, ly0 = y0 - layer.y;
        const lx1 = x1 - layer.x, ly1 = y1 - layer.y;

        const ctx = layer.ctx;
        ctx.save();
        let grad;
        if (this.toolSettings.gradient.type === 'radial') {
            const r = Math.hypot(lx1 - lx0, ly1 - ly0);
            grad = ctx.createRadialGradient(lx0, ly0, 0, lx0, ly0, r);
        } else {
            grad = ctx.createLinearGradient(lx0, ly0, lx1, ly1);
        }

        grad.addColorStop(0, this.foregroundColor);
        grad.addColorStop(1, this.backgroundColor);
        ctx.fillStyle = grad;

        if (this.selection && this.selectionPath) {
            ctx.save();
            ctx.translate(-layer.x, -layer.y);
            ctx.clip(this.selectionPath);
            ctx.restore();
        }

        ctx.fillRect(0, 0, layer.width, layer.height);
        ctx.restore();
        this.recordHistory('Gradient');
    }

    drawShape(x0, y0, x1, y1) {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const ctx = layer.ctx;
        const s = this.toolSettings.shape;

        const x = Math.min(x0, x1) - layer.x;
        const y = Math.min(y0, y1) - layer.y;
        const w = Math.abs(x1 - x0);
        const h = Math.abs(y1 - y0);

        ctx.save();
        ctx.fillStyle = this.foregroundColor;
        ctx.strokeStyle = this.backgroundColor;
        ctx.lineWidth = s.strokeWidth;

        ctx.beginPath();
        if (s.type === 'ellipse') {
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else if (s.type === 'line') {
            ctx.moveTo(x0 - layer.x, y0 - layer.y);
            ctx.lineTo(x1 - layer.x, y1 - layer.y);
        } else if (s.type === 'rounded') {
            ctx.roundRect(x, y, w, h, s.radius);
        } else {
            ctx.rect(x, y, w, h);
        }

        if (s.fill && s.type !== 'line') ctx.fill();
        if (s.stroke || s.type === 'line') ctx.stroke();
        ctx.restore();
        this.recordHistory('Shape');
    }

    placeText(x, y) {
        const t = this.toolSettings.type;
        const layer = this.addLayer('Text - ' + t.text.substring(0, 12));
        const ctx = layer.ctx;

        ctx.save();
        ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`;
        ctx.fillStyle = this.foregroundColor;
        ctx.textBaseline = 'top';
        ctx.fillText(t.text, x, y);
        ctx.restore();

        this.recordHistory('Add Text');
        this.render();
    }

    sampleColorAt(docX, docY) {
        const imgData = this.ctx.getImageData(Math.round(docX), Math.round(docY), 1, 1).data;
        const hex = this.rgbToHex(imgData[0], imgData[1], imgData[2]);
        this.foregroundColor = hex;
        if (this.onColorChange) this.onColorChange(this.foregroundColor, this.backgroundColor);
        this.notifyStatus(`Sampled color: ${hex}`);
    }

    // --- Selections ---

    setRectSelection(x, y, w, h, isEllipse = false) {
        const path = new Path2D();
        if (isEllipse) {
            path.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else {
            path.rect(x, y, w, h);
        }
        const mask = new Uint8Array(this.width * this.height);
        const x0 = Math.max(0, Math.floor(x));
        const y0 = Math.max(0, Math.floor(y));
        const x1 = Math.min(this.width, Math.ceil(x + w));
        const y1 = Math.min(this.height, Math.ceil(y + h));
        const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
        for (let py = y0; py < y1; py++) {
            for (let px = x0; px < x1; px++) {
                if (isEllipse) {
                    const dx = (px + 0.5 - cx) / rx;
                    const dy = (py + 0.5 - cy) / ry;
                    if (dx * dx + dy * dy <= 1.0) {
                        mask[py * this.width + px] = 255;
                    }
                } else {
                    mask[py * this.width + px] = 255;
                }
            }
        }
        this.selection = {
            type: isEllipse ? 'ellipse' : 'rect',
            bounds: { x, y, width: w, height: h },
            mask,
            width: this.width,
            height: this.height
        };
        this.selectionPath = path;
    }

    updateLassoSelection() {
        if (!this.lassoPoints || this.lassoPoints.length < 2) return;
        const path = new Path2D();
        path.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
            path.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        this.selectionPath = path;
    }

    finalizeLassoSelection() {
        if (!this.lassoPoints || this.lassoPoints.length < 3) return;
        const path = new Path2D();
        path.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
            path.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        path.closePath();
        this.selection = { type: 'lasso' };
        this.selectionPath = path;
    }

    selectAll() {
        this.setRectSelection(0, 0, this.width, this.height, false);
        this.render();
    }

    deselect() {
        this.selection = null;
        this.selectionPath = null;
        this.render();
    }

    invertSelection() {
        if (!this.selection) return;
        // Invert path using evenodd filling
        const path = new Path2D();
        path.rect(0, 0, this.width, this.height);
        if (this.selectionPath) path.addPath(this.selectionPath);
        this.selectionPath = path;
        this.render();
    }

    magicWandSelect(x, y, tolerance = 32, contiguous = true) {
        const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imgData.data;
        const w = this.width, h = this.height;
        const sx = Math.floor(x), sy = Math.floor(y);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

        const targetIdx = (sy * w + sx) * 4;
        const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2], ta = data[targetIdx + 3];

        const mask = new Uint8Array(w * h);
        const matches = (idx) => {
            return Math.abs(data[idx] - tr) <= tolerance &&
                   Math.abs(data[idx + 1] - tg) <= tolerance &&
                   Math.abs(data[idx + 2] - tb) <= tolerance &&
                   Math.abs(data[idx + 3] - ta) <= tolerance;
        };

        if (!contiguous) {
            for (let i = 0; i < w * h; i++) {
                if (matches(i * 4)) mask[i] = 255;
            }
        } else {
            // Flood fill scanline queue
            const queue = [sx + sy * w];
            mask[sx + sy * w] = 255;
            while (queue.length > 0) {
                const pos = queue.pop();
                const px = pos % w, py = Math.floor(pos / w);
                const neighbors = [
                    px > 0 ? pos - 1 : -1,
                    px < w - 1 ? pos + 1 : -1,
                    py > 0 ? pos - w : -1,
                    py < h - 1 ? pos + w : -1
                ];
                for (const n of neighbors) {
                    if (n !== -1 && mask[n] === 0 && matches(n * 4)) {
                        mask[n] = 255;
                        queue.push(n);
                    }
                }
            }
        }

        // Trace bounding contour for selection path
        this.selection = { mask, width: w, height: h };
        this.createPathFromMask(mask, w, h);
        this.render();
    }

    createPathFromMask(mask, w, h) {
        const path = new Path2D();
        // Trace horizontal runs
        for (let y = 0; y < h; y += 2) {
            let inRun = false;
            let startX = 0;
            for (let x = 0; x < w; x += 2) {
                if (mask[y * w + x] > 0) {
                    if (!inRun) { inRun = true; startX = x; }
                } else if (inRun) {
                    inRun = false;
                    path.rect(startX, y, x - startX, 2);
                }
            }
            if (inRun) path.rect(startX, y, w - startX, 2);
        }
        this.selectionPath = path;
    }

    // --- Color Adjustments & Filters ---

    applyLevels(blackPoint = 0, gamma = 1.0, whitePoint = 255, outBlack = 0, outWhite = 255) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        // Build 256-entry lookup table matching LevelsPixels.c
        const lut = new Uint8Array(256);
        const scale = 1.0 / Math.max(1, whitePoint - blackPoint);
        const invGamma = 1.0 / Math.max(0.01, gamma);

        for (let i = 0; i < 256; i++) {
            let val = (i - blackPoint) * scale;
            val = Math.max(0, Math.min(1, val));
            val = Math.pow(val, invGamma);
            val = outBlack + val * (outWhite - outBlack);
            lut[i] = Math.max(0, Math.min(255, Math.round(val)));
        }

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            data[i] = lut[data[i]];
            data[i + 1] = lut[data[i + 1]];
            data[i + 2] = lut[data[i + 2]];
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Levels');
        this.render();
    }

    computeHistogram() {
        const layer = this.getActiveLayer();
        if (!layer) return null;
        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height).data;

        const red = new Float32Array(256);
        const green = new Float32Array(256);
        const blue = new Float32Array(256);
        const lum = new Float32Array(256);

        for (let i = 0; i < imgData.length; i += 4) {
            if (imgData[i + 3] === 0) continue;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            red[r]++;
            green[g]++;
            blue[b]++;
            lum[l]++;
        }

        return { red, green, blue, lum };
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                case b: h = ((r - g) / d + 4); break;
            }
            h *= 60;
        }

        return {
            h: Math.round(h),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r1 = 0, g1 = 0, b1 = 0;

        if (h >= 0 && h < 60) {
            r1 = c; g1 = x; b1 = 0;
        } else if (h >= 60 && h < 120) {
            r1 = x; g1 = c; b1 = 0;
        } else if (h >= 120 && h < 180) {
            r1 = 0; g1 = c; b1 = x;
        } else if (h >= 180 && h < 240) {
            r1 = 0; g1 = x; b1 = c;
        } else if (h >= 240 && h < 300) {
            r1 = x; g1 = 0; b1 = c;
        } else {
            r1 = c; g1 = 0; b1 = x;
        }

        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255)
        };
    }

    hexToRgb(hex) {
        if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
        hex = hex.trim();
        if (hex.startsWith('#')) hex = hex.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        if (isNaN(num)) return { r: 0, g: 0, b: 0 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    rgbToHex(r, g, b) {
        const toHex = c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    applyHueSaturation(hueShift = 0, satShift = 0, lightShift = 0) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            let hsl = this.rgbToHsl(data[i], data[i + 1], data[i + 2]);
            hsl.h = (hsl.h + hueShift + 360) % 360;
            hsl.s = Math.max(0, Math.min(100, hsl.s + satShift));
            hsl.l = Math.max(0, Math.min(100, hsl.l + lightShift));
            const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Hue/Saturation');
        this.render();
    }

    applyInvert() {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Invert');
        this.render();
    }

    applyGaussianBlur(radius = 5) {
        if (radius <= 0) return;
        const layer = this.getActiveLayer();
        if (!layer) return;

        // Fast canvas blur using CSS filter rendering
        const tempCanvas = this.createCanvas(layer.width, layer.height);
        tempCanvas.width = layer.width;
        tempCanvas.height = layer.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.filter = `blur(${radius}px)`;
        tempCtx.drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.width, layer.height);
        layer.ctx.drawImage(tempCanvas, 0, 0);

        this.recordHistory(`Gaussian Blur (${radius}px)`);
        this.render();
    }

    applyAddNoise(amount = 20) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;
        const factor = (amount / 100) * 255;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const noise = (Math.random() - 0.5) * factor;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Add Noise');
        this.render();
    }

    applyMotionBlur(angle = 0, distance = 10) {
        if (distance <= 0) return;
        const layer = this.getActiveLayer();
        if (!layer) return;

        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = -Math.sin(rad);
        const steps = Math.max(1, Math.round(distance));

        const srcData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const dstData = layer.ctx.createImageData ? layer.ctx.createImageData(layer.width, layer.height) : { data: new Uint8ClampedArray(layer.width * layer.height * 4), width: layer.width, height: layer.height };
        const src = srcData.data;
        const dst = dstData.data;
        const w = layer.width, h = layer.height;

        const half = steps / 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                for (let s = -half; s <= half; s++) {
                    const sx = Math.round(x + s * dx);
                    const sy = Math.round(y + s * dy);
                    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                        const idx = (sy * w + sx) * 4;
                        r += src[idx];
                        g += src[idx + 1];
                        b += src[idx + 2];
                        a += src[idx + 3];
                        count++;
                    }
                }
                const outIdx = (y * w + x) * 4;
                if (count > 0) {
                    dst[outIdx] = Math.round(r / count);
                    dst[outIdx + 1] = Math.round(g / count);
                    dst[outIdx + 2] = Math.round(b / count);
                    dst[outIdx + 3] = Math.round(a / count);
                }
            }
        }

        layer.ctx.putImageData(dstData, 0, 0);
        this.recordHistory(`Motion Blur (${distance}px)`);
        this.render();
    }

    applyFilmGrain(amount = 25, size = 1.5, roughness = 50) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;
        const w = layer.width, h = layer.height;

        // Improved grain size behavior matching commit 59b5040:
        // Co-scale detail roughness with size: fmax(0.5, size * 0.35)
        const detailSize = Math.max(0.5, size * 0.35);
        const strength = (amount > 100 ? 1.0 : amount / 100.0) * 0.35 * 255.0;
        const rough = Math.max(0, Math.min(1.0, roughness / 100.0));

        const lattice = (ix, iy, s) => {
            let h = Math.imul(ix ^ Math.imul(iy, 0x85ebca6b), 0x9e3779b9) ^ s;
            h ^= h >>> 16;
            h = Math.imul(h, 0x85ebca6b);
            h ^= h >>> 13;
            return ((h & 0xffff) / 65535.0) + (((h >>> 16) & 0xffff) / 65535.0) - 1.0;
        };

        const grainField = (u, v, scale, s) => {
            const cellX = Math.floor(u / scale), cellY = Math.floor(v / scale);
            let tx = u / scale - cellX, ty = v / scale - cellY;
            tx = tx * tx * (3.0 - 2.0 * tx);
            ty = ty * ty * (3.0 - 2.0 * ty);
            const ix = cellX, iy = cellY;
            const n00 = lattice(ix, iy, s), n10 = lattice(ix + 1, iy, s);
            const n01 = lattice(ix, iy + 1, s), n11 = lattice(ix + 1, iy + 1, s);
            const top = n00 + (n10 - n00) * tx;
            const bottom = n01 + (n11 - n01) * tx;
            return (top + (bottom - top) * ty) * 1.6;
        };

        const seed = 0x4d5a6b7c;
        const fineSeed = seed ^ 0xa511e9b3;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const a = data[idx + 3];
                if (a === 0) continue;

                const smooth = grainField(x + 0.5, y + 0.5, size, seed);
                const fine = grainField(x + 0.5, y + 0.5, detailSize, fineSeed);
                const noise = (smooth + (fine - smooth) * rough) * strength;

                data[idx] = Math.max(0, Math.min(255, data[idx] + noise));
                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + noise));
                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + noise));
            }
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Film Grain');
        this.render();
    }

    applyCameraRaw(settings = {}) {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const temperature = Math.max(-100, Math.min(100, settings.temperature || 0));
        const tint = Math.max(-100, Math.min(100, settings.tint || 0));
        const exposure = Math.max(-5, Math.min(5, settings.exposure || 0));
        const contrast = Math.max(-100, Math.min(100, settings.contrast || 0));
        const highlights = Math.max(-100, Math.min(100, settings.highlights || 0));
        const shadows = Math.max(-100, Math.min(100, settings.shadows || 0));
        const whites = Math.max(-100, Math.min(100, settings.whites || 0));
        const blacks = Math.max(-100, Math.min(100, settings.blacks || 0));
        const vibrance = Math.max(-100, Math.min(100, settings.vibrance || 0));
        const saturation = Math.max(-100, Math.min(100, settings.saturation || 0));
        const texture = Math.max(-100, Math.min(100, settings.texture || 0));
        const clarity = Math.max(-100, Math.min(100, settings.clarity || 0));
        const dehaze = Math.max(-100, Math.min(100, settings.dehaze || 0));

        // Temperature & Tint multipliers
        const tempGain = (temperature / 100) * 0.35;
        const tintGain = (tint / 100);
        const rGain = 1.0 + tempGain + tintGain * 0.15;
        const gGain = 1.0 - tintGain * 0.30;
        const bGain = 1.0 - tempGain + tintGain * 0.15;

        // Exposure multiplier: 2^stops
        const expMult = Math.pow(2.0, exposure);
        const contrastFactor = (100 + contrast) / 100;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            if (this.selection) {
                const px = (i / 4) % layer.width;
                const py = Math.floor((i / 4) / layer.width);
                const docX = Math.round(layer.x + px);
                const docY = Math.round(layer.y + py);
                if (this.selection.mask) {
                    if (docX < 0 || docX >= this.width || docY < 0 || docY >= this.height || this.selection.mask[docY * this.width + docX] === 0) {
                        continue;
                    }
                } else if (this.selection.bounds) {
                    const b = this.selection.bounds;
                    if (docX < b.x || docX >= b.x + b.width || docY < b.y || docY >= b.y + b.height) {
                        continue;
                    }
                }
            }

            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 1. White balance
            r = Math.min(255, Math.max(0, r * rGain));
            g = Math.min(255, Math.max(0, g * gGain));
            b = Math.min(255, Math.max(0, b * bGain));

            // 2. Exposure
            r = Math.min(255, Math.max(0, r * expMult));
            g = Math.min(255, Math.max(0, g * expMult));
            b = Math.min(255, Math.max(0, b * expMult));

            // 3. Tone controls (highlights, shadows, whites, blacks)
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const normLum = lum / 255;

            if (shadows !== 0 && normLum < 0.5) {
                const shadowWeight = (1.0 - normLum * 2);
                const shift = (shadows / 100) * 35 * shadowWeight;
                r = Math.min(255, Math.max(0, r + shift));
                g = Math.min(255, Math.max(0, g + shift));
                b = Math.min(255, Math.max(0, b + shift));
            }

            if (highlights !== 0 && normLum > 0.5) {
                const highlightWeight = (normLum - 0.5) * 2;
                const shift = (highlights / 100) * 35 * highlightWeight;
                r = Math.min(255, Math.max(0, r + shift));
                g = Math.min(255, Math.max(0, g + shift));
                b = Math.min(255, Math.max(0, b + shift));
            }

            if (whites !== 0) {
                r = Math.min(255, Math.max(0, r + (whites / 100) * 20 * normLum));
                g = Math.min(255, Math.max(0, g + (whites / 100) * 20 * normLum));
                b = Math.min(255, Math.max(0, b + (whites / 100) * 20 * normLum));
            }
            if (blacks !== 0) {
                const blackWeight = 1.0 - normLum;
                r = Math.min(255, Math.max(0, r + (blacks / 100) * 20 * blackWeight));
                g = Math.min(255, Math.max(0, g + (blacks / 100) * 20 * blackWeight));
                b = Math.min(255, Math.max(0, b + (blacks / 100) * 20 * blackWeight));
            }

            // 4. Contrast
            if (contrast !== 0) {
                r = Math.min(255, Math.max(0, (r - 128) * contrastFactor + 128));
                g = Math.min(255, Math.max(0, (g - 128) * contrastFactor + 128));
                b = Math.min(255, Math.max(0, (b - 128) * contrastFactor + 128));
            }

            // 5. Vibrance & Saturation
            if (vibrance !== 0 || saturation !== 0) {
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const currentSat = maxC === 0 ? 0 : (maxC - minC) / maxC;
                const vibWeight = 1.0 - currentSat;
                const totalSatShift = (saturation / 100) + (vibrance / 100) * vibWeight;
                const avg = 0.299 * r + 0.587 * g + 0.114 * b;
                r = Math.min(255, Math.max(0, avg + (r - avg) * (1.0 + totalSatShift)));
                g = Math.min(255, Math.max(0, avg + (g - avg) * (1.0 + totalSatShift)));
                b = Math.min(255, Math.max(0, avg + (b - avg) * (1.0 + totalSatShift)));
            }

            // 6. Clarity & Dehaze
            if (clarity !== 0 || dehaze !== 0) {
                const punch = ((clarity * 0.4 + dehaze * 0.6) / 100) * 25;
                const distFromMid = 1.0 - Math.abs(normLum - 0.5) * 2;
                const shift = punch * distFromMid;
                r = Math.min(255, Math.max(0, r + shift * (r > 128 ? 1 : -1)));
                g = Math.min(255, Math.max(0, g + shift * (g > 128 ? 1 : -1)));
                b = Math.min(255, Math.max(0, b + shift * (b > 128 ? 1 : -1)));
            }

            data[i] = Math.round(r);
            data[i + 1] = Math.round(g);
            data[i + 2] = Math.round(b);
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Camera Raw Filter');
        this.render();
    }

    calculateTrimRect(options = {}) {
        const basedOn = options.basedOn || 'transparentPixels';
        const top = options.top !== false;
        const bottom = options.bottom !== false;
        const left = options.left !== false;
        const right = options.right !== false;
        const tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0;

        if (!top && !bottom && !left && !right) return null;
        if (this.width <= 0 || this.height <= 0) return null;

        // Composite visible layers into temporary canvas to sample full canvas pixels
        const compCanvas = this.createCanvas(this.width, this.height);
        const compCtx = compCanvas.getContext('2d');
        for (const layer of this.layers) {
            if (!layer.visible) continue;
            compCtx.save();
            compCtx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
            compCtx.globalCompositeOperation = this.mapBlendMode(layer.blendMode);
            compCtx.drawImage(layer.canvas, layer.x, layer.y);
            compCtx.restore();
        }

        const imgData = compCtx.getImageData(0, 0, this.width, this.height);
        const data = imgData.data;
        const w = this.width, h = this.height;

        if (basedOn === 'transparentPixels' || basedOn === 'transparent') {
            let minX = w, maxX = 0, minY = h, maxY = 0;
            let hasContent = false;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    if (data[idx + 3] > tolerance) {
                        hasContent = true;
                        if (x < minX) minX = x;
                        if (x + 1 > maxX) maxX = x + 1;
                        if (y < minY) minY = y;
                        if (y + 1 > maxY) maxY = y + 1;
                    }
                }
            }
            if (!hasContent) return null;
            const cropL = left ? minX : 0;
            const cropT = top ? minY : 0;
            const cropR = right ? maxX : w;
            const cropB = bottom ? maxY : h;
            if (cropR <= cropL || cropB <= cropT) return null;
            return { x: cropL, y: cropT, width: cropR - cropL, height: cropB - cropT };
        } else {
            let sampleX = 0, sampleY = 0;
            if (basedOn === 'bottomRightPixelColor' || basedOn === 'bottomRight') {
                sampleX = w - 1;
                sampleY = h - 1;
            }
            const sIdx = (sampleY * w + sampleX) * 4;
            const tr = data[sIdx], tg = data[sIdx + 1], tb = data[sIdx + 2], ta = data[sIdx + 3];

            const pixelMatches = (x, y) => {
                const idx = (y * w + x) * 4;
                return Math.abs(data[idx] - tr) <= tolerance &&
                       Math.abs(data[idx + 1] - tg) <= tolerance &&
                       Math.abs(data[idx + 2] - tb) <= tolerance &&
                       Math.abs(data[idx + 3] - ta) <= tolerance;
            };

            let minX = w, maxX = 0, minY = h, maxY = 0;
            let hasContent = false;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (!pixelMatches(x, y)) {
                        hasContent = true;
                        if (x < minX) minX = x;
                        if (x + 1 > maxX) maxX = x + 1;
                        if (y < minY) minY = y;
                        if (y + 1 > maxY) maxY = y + 1;
                    }
                }
            }
            if (!hasContent) return null;
            const cropL = left ? minX : 0;
            const cropT = top ? minY : 0;
            const cropR = right ? maxX : w;
            const cropB = bottom ? maxY : h;
            if (cropR <= cropL || cropB <= cropT) return null;
            return { x: cropL, y: cropT, width: cropR - cropL, height: cropB - cropT };
        }
    }

    trimCanvas(options = {}) {
        const rect = this.calculateTrimRect(options);
        if (!rect) return false;
        if (rect.x === 0 && rect.y === 0 && rect.width === this.width && rect.height === this.height) {
            return true;
        }

        const oldW = this.width, oldH = this.height;
        if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
            this.history[this.historyIndex].width = oldW;
            this.history[this.historyIndex].height = oldH;
            this.history[this.historyIndex].layers.forEach((snapL, idx) => {
                const liveL = this.layers[idx];
                if (liveL && snapL) {
                    snapL.x = liveL.x;
                    snapL.y = liveL.y;
                }
            });
        }

        this.width = rect.width;
        this.height = rect.height;
        const dx = -rect.x;
        const dy = -rect.y;

        for (const layer of this.layers) {
            layer.x += dx;
            layer.y += dy;
        }

        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.overlay) {
            this.overlay.width = this.width;
            this.overlay.height = this.height;
        }

        this.recordHistory('Trim Canvas');
        this.render();
        this.notifyUI();
        return true;
    }

    addAdjustmentLayer(kind, settings = {}) {
        const layer = this.addLayer(`${kind} Adjustment`);
        layer.isAdjustment = true;
        layer.adjustment = {
            kind,
            ...settings
        };
        this.recordHistory(`Add ${kind} Adjustment Layer`);
        this.render();
        this.notifyUI();
        return layer;
    }

    applyContentAwareFill() {
        const layer = this.getActiveLayer();
        if (!layer || !this.selection) return;

        // Matching ContentFill.c patch synthesis
        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;
        const w = layer.width, h = layer.height;

        // Sample neighboring boundary pixels and diffuse inward
        for (let iter = 0; iter < 10; iter++) {
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    if (data[idx + 3] === 0 || (this.selection.mask && this.selection.mask[y * w + x] > 0)) {
                        const top = ((y - 1) * w + x) * 4;
                        const bot = ((y + 1) * w + x) * 4;
                        const left = (y * w + x - 1) * 4;
                        const right = (y * w + x + 1) * 4;

                        data[idx] = (data[top] + data[bot] + data[left] + data[right]) >> 2;
                        data[idx + 1] = (data[top + 1] + data[bot + 1] + data[left + 1] + data[right + 1]) >> 2;
                        data[idx + 2] = (data[top + 2] + data[bot + 2] + data[left + 2] + data[right + 2]) >> 2;
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Content-Aware Fill');
        this.render();
    }

    // --- Transforms & Utilities ---

    selectLayerUnderPoint(x, y) {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const l = this.layers[i];
            if (!l.visible) continue;
            if (x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height) {
                // Check non-transparent pixel
                const lx = Math.floor(x - l.x);
                const ly = Math.floor(y - l.y);
                const alpha = l.ctx.getImageData(lx, ly, 1, 1).data[3];
                if (alpha > 5) {
                    this.activeLayerId = l.id;
                    this.notifyUI();
                    return l;
                }
            }
        }
        return null;
    }

    updateTransformBox() {
        const l = this.getActiveLayer();
        if (l) {
            this.transformBox = { x: l.x, y: l.y, width: l.width, height: l.height };
        } else {
            this.transformBox = null;
        }
    }

    flipLayer(horizontally = true) {
        const l = this.getActiveLayer();
        if (!l) return;
        if (horizontally) l.flipX = !l.flipX;
        else l.flipY = !l.flipY;
        this.recordHistory(`Flip Layer ${horizontally ? 'Horizontal' : 'Vertical'}`);
        this.render();
    }

    flipCanvas(horizontally = true) {
        for (const l of this.layers) {
            if (horizontally) {
                l.x = this.width - (l.x + l.width);
                l.flipX = !l.flipX;
            } else {
                l.y = this.height - (l.y + l.height);
                l.flipY = !l.flipY;
            }
        }
        if (horizontally) {
            this.guides.vertical = this.guides.vertical.map(v => this.width - v);
        } else {
            this.guides.horizontal = this.guides.horizontal.map(h => this.height - h);
        }
        this.recordHistory(`Flip Canvas ${horizontally ? 'Horizontal' : 'Vertical'}`);
        this.render();
    }

    // --- Viewport Navigation ---

    fitToScreen(containerWidth = window.innerWidth - 360, containerHeight = window.innerHeight - 120) {
        const scaleX = (containerWidth - 60) / this.width;
        const scaleY = (containerHeight - 60) / this.height;
        const fitScale = Math.min(scaleX, scaleY, 1.0);
        this.zoomTo(Math.max(0.05, fitScale));
        this.viewport.panX = (containerWidth - this.width * this.viewport.zoom) / 2;
        this.viewport.panY = (containerHeight - this.height * this.viewport.zoom) / 2;
    }

    zoomTo(level) {
        this.viewport.zoom = Math.max(0.05, Math.min(32.0, level));
        if (this.onZoomChange) this.onZoomChange(this.viewport.zoom);
    }

    zoomIn() { this.zoomTo(this.viewport.zoom * 1.25); }
    zoomOut() { this.zoomTo(this.viewport.zoom / 1.25); }

    // --- History / Undo ---

    recordHistory(name = 'Action') {
        // Discard future redos
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Snapshot layers
        const snapshot = {
            name,
            activeLayerId: this.activeLayerId,
            width: this.width,
            height: this.height,
            layers: this.layers.map(l => {
                const copyCanvas = this.createCanvas(l.width, l.height);
                copyCanvas.width = l.width;
                copyCanvas.height = l.height;
                copyCanvas.getContext('2d').drawImage(l.canvas, 0, 0);

                let maskCopy = null;
                if (l.hasMask && l.maskCanvas) {
                    maskCopy = this.createCanvas(l.width, l.height);
                    maskCopy.width = l.width;
                    maskCopy.height = l.height;
                    maskCopy.getContext('2d').drawImage(l.maskCanvas, 0, 0);
                }

                return {
                    id: l.id,
                    name: l.name,
                    visible: l.visible,
                    opacity: l.opacity,
                    blendMode: l.blendMode,
                    x: l.x,
                    y: l.y,
                    width: l.width,
                    height: l.height,
                    rotation: l.rotation,
                    flipX: l.flipX,
                    flipY: l.flipY,
                    canvas: copyCanvas,
                    ctx: copyCanvas.getContext('2d', { willReadFrequently: true }),
                    hasMask: l.hasMask,
                    maskCanvas: maskCopy,
                    maskCtx: maskCopy ? maskCopy.getContext('2d', { willReadFrequently: true }) : null,
                    maskEnabled: l.maskEnabled,
                    maskSourceId: l.maskSourceId,
                    liveText: l.liveText ? JSON.parse(JSON.stringify(l.liveText)) : null,
                    shapeType: l.shapeType || null,
                    shapeCornerRadius: l.shapeCornerRadius || 0,
                    effects: l.effects ? JSON.parse(JSON.stringify(l.effects)) : null
                };
            })
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.historyIndex = this.history.length - 1;

        if (this.onHistoryChange) this.onHistoryChange(this.history, this.historyIndex);
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreSnapshot(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreSnapshot(this.history[this.historyIndex]);
        }
    }

    restoreSnapshot(snapshot) {
        this.activeLayerId = snapshot.activeLayerId;
        if (snapshot.width) this.width = snapshot.width;
        if (snapshot.height) this.height = snapshot.height;
        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.overlay) {
            this.overlay.width = this.width;
            this.overlay.height = this.height;
        }
        this.layers = snapshot.layers.map(l => {
            const canvas = this.createCanvas(l.width, l.height);
            canvas.width = l.width;
            canvas.height = l.height;
            canvas.getContext('2d').drawImage(l.canvas, 0, 0);

            let maskCanvas = null;
            if (l.hasMask && l.maskCanvas) {
                maskCanvas = this.createCanvas(l.width, l.height);
                maskCanvas.width = l.width;
                maskCanvas.height = l.height;
                maskCanvas.getContext('2d').drawImage(l.maskCanvas, 0, 0);
            }

            return {
                ...l,
                liveText: l.liveText ? JSON.parse(JSON.stringify(l.liveText)) : null,
                shapeType: l.shapeType || null,
                shapeCornerRadius: l.shapeCornerRadius || 0,
                effects: l.effects ? JSON.parse(JSON.stringify(l.effects)) : null,
                canvas,
                ctx: canvas.getContext('2d', { willReadFrequently: true }),
                maskCanvas,
                maskCtx: maskCanvas ? maskCanvas.getContext('2d', { willReadFrequently: true }) : null
            };
        });

        this.render();
        this.notifyUI();
        if (this.onHistoryChange) this.onHistoryChange(this.history, this.historyIndex);
    }

    // --- Helpers ---

    notifyUI() {
        if (this.onLayerListChange) this.onLayerListChange(this.layers);
        if (this.onActiveLayerChange) this.onActiveLayerChange(this.getActiveLayer());
    }

    createCanvas(w, h) {
        if (!this.isHeadless && typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            return canvas;
        }
        return createMockCanvas(w, h);
    }

    // --- Extended Feature Parity Methods ---

    static get BLEND_MODES() {
        return [
            'Normal',
            'Multiply',
            'Screen',
            'Overlay',
            'Darken',
            'Lighten',
            'Color Dodge',
            'Color Burn',
            'Difference',
            'Soft Light',
            'Hard Light'
        ];
    }

    cycleBlendMode(forward = true) {
        const active = this.getActiveLayer();
        if (!active) return;
        const modes = CompositorEngine.BLEND_MODES;
        let idx = modes.indexOf(active.blendMode);
        if (idx === -1) idx = 0;

        if (forward) {
            idx = (idx + 1) % modes.length;
        } else {
            idx = (idx - 1 + modes.length) % modes.length;
        }

        active.blendMode = modes[idx];
        this.recordHistory('Change Blend Mode');
        this.render();
        this.notifyUI();
    }

    resizeCanvas(newWidth, newHeight, anchor = 'center') {
        const oldW = this.width, oldH = this.height;
        if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
            this.history[this.historyIndex].width = oldW;
            this.history[this.historyIndex].height = oldH;
            this.history[this.historyIndex].layers.forEach((snapL, idx) => {
                const liveL = this.layers[idx];
                if (liveL && snapL) {
                    snapL.x = liveL.x;
                    snapL.y = liveL.y;
                }
            });
        }

        this.width = Math.max(1, Math.min(30000, newWidth));
        this.height = Math.max(1, Math.min(30000, newHeight));

        let dx = 0, dy = 0;
        if (typeof anchor === 'number') {
            // Anchors 0..8 matching Mac CanvasSizeOptions (anchor % 3 for x, anchor / 3 for y)
            const ax = anchor % 3; // 0: left, 1: center, 2: right
            const ay = Math.floor(anchor / 3); // 0: top, 1: center, 2: bottom
            dx = ax === 0 ? 0 : (ax === 1 ? Math.round((this.width - oldW) / 2) : this.width - oldW);
            dy = ay === 0 ? 0 : (ay === 1 ? Math.round((this.height - oldH) / 2) : this.height - oldH);
        } else {
            switch (anchor) {
                case 'center':
                    dx = Math.round((this.width - oldW) / 2);
                    dy = Math.round((this.height - oldH) / 2);
                    break;
                case 'top-left':
                    dx = 0; dy = 0;
                    break;
                case 'top-right':
                    dx = this.width - oldW; dy = 0;
                    break;
                case 'bottom-left':
                    dx = 0; dy = this.height - oldH;
                    break;
                case 'bottom-right':
                    dx = this.width - oldW; dy = this.height - oldH;
                    break;
            }
        }

        for (const layer of this.layers) {
            layer.x += dx;
            layer.y += dy;
        }

        if (dx !== 0) {
            this.guides.vertical = this.guides.vertical.map(v => v + dx);
        }
        if (dy !== 0) {
            this.guides.horizontal = this.guides.horizontal.map(h => h + dy);
        }

        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.overlay) {
            this.overlay.width = this.width;
            this.overlay.height = this.height;
        }

        this.recordHistory('Canvas Size');
        this.render();
        this.notifyUI();
    }

    resizeImage(newWidth, newHeight) {
        const scaleX = newWidth / this.width;
        const scaleY = newHeight / this.height;

        this.width = Math.max(1, Math.min(30000, newWidth));
        this.height = Math.max(1, Math.min(30000, newHeight));

        for (const layer of this.layers) {
            layer.x = Math.round(layer.x * scaleX);
            layer.y = Math.round(layer.y * scaleY);
            const newLayerW = Math.max(1, Math.round(layer.width * scaleX));
            const newLayerH = Math.max(1, Math.round(layer.height * scaleY));

            const newCanvas = this.createCanvas(newLayerW, newLayerH);
            const newCtx = newCanvas.getContext('2d');
            newCtx.drawImage(layer.canvas, 0, 0, newLayerW, newLayerH);
            layer.canvas = newCanvas;
            layer.ctx = newCtx;
            layer.width = newLayerW;
            layer.height = newLayerH;

            if (layer.hasMask && layer.maskCanvas) {
                const newMask = this.createCanvas(newLayerW, newLayerH);
                const newMaskCtx = newMask.getContext('2d');
                newMaskCtx.drawImage(layer.maskCanvas, 0, 0, newLayerW, newLayerH);
                layer.maskCanvas = newMask;
                layer.maskCtx = newMaskCtx;
            }
        }

        this.guides.vertical = this.guides.vertical.map(v => Math.round(v * scaleX));
        this.guides.horizontal = this.guides.horizontal.map(h => Math.round(h * scaleY));

        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.overlay) {
            this.overlay.width = this.width;
            this.overlay.height = this.height;
        }

        this.recordHistory('Image Size');
        this.render();
        this.notifyUI();
    }

    crop(x, y, width, height) {
        const clampedX = Math.max(0, Math.min(this.width, x));
        const clampedY = Math.max(0, Math.min(this.height, y));
        const clampedW = Math.max(1, Math.min(this.width - clampedX, width));
        const clampedH = Math.max(1, Math.min(this.height - clampedY, height));

        this.width = clampedW;
        this.height = clampedH;

        for (const layer of this.layers) {
            layer.x -= clampedX;
            layer.y -= clampedY;
        }

        if (this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        if (this.overlay) {
            this.overlay.width = this.width;
            this.overlay.height = this.height;
        }

        this.cropBox = null;
        this.recordHistory('Crop');
        this.render();
        this.notifyUI();
    }

    applyCurves(curveTable, channel = 'rgb') {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            if (channel === 'rgb' || channel === 'red') data[i] = curveTable[data[i]];
            if (channel === 'rgb' || channel === 'green') data[i + 1] = curveTable[data[i + 1]];
            if (channel === 'rgb' || channel === 'blue') data[i + 2] = curveTable[data[i + 2]];
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Curves');
        this.render();
    }

    applyExposure(exposure = 0, offset = 0, gamma = 1.0) {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;
        const scale = Math.pow(2, exposure);
        const invGamma = 1.0 / Math.max(0.01, gamma);

        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            let v = (i / 255.0) * scale + (offset / 255.0);
            v = Math.max(0, Math.min(1, v));
            v = Math.pow(v, invGamma);
            lut[i] = Math.round(v * 255);
        }

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            data[i] = lut[data[i]];
            data[i + 1] = lut[data[i + 1]];
            data[i + 2] = lut[data[i + 2]];
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Exposure');
        this.render();
    }

    applyGradientMap(gradientTable) {
        const layer = this.getActiveLayer();
        if (!layer) return;
        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;

        // Matching AdjustPixels.c: level = (2126*r + 7152*g + 722*b + 5000) / 10000
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const level = Math.min(255, Math.floor((2126 * r + 7152 * g + 722 * b + 5000) / 10000));
            const color = gradientTable[level]; // { r, g, b }
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Gradient Map');
        this.render();
    }

    // --- Brush Stepping & Tool Properties ---

    stepBrushSize(delta = 5) {
        const current = this.toolSettings.brush.size;
        const next = Math.max(1, Math.min(1000, current + delta));
        this.toolSettings.brush.size = next;
        return next;
    }

    stepBrushHardness(delta = 25) {
        const current = this.toolSettings.brush.hardness;
        const next = Math.max(0, Math.min(100, current + delta));
        this.toolSettings.brush.hardness = next;
        return next;
    }

    // --- Guides & Snapping Pipeline ---

    addGuide(guideOrAxis, maybePos) {
        if (this.locksGuides) return null;
        let axis, position, id;
        if (typeof guideOrAxis === 'object') {
            axis = guideOrAxis.axis;
            position = guideOrAxis.position;
            id = guideOrAxis.id || 'g_' + Math.random().toString(36).substring(2, 9);
        } else {
            axis = guideOrAxis;
            position = maybePos;
            id = 'g_' + Math.random().toString(36).substring(2, 9);
        }
        const guide = { id, axis, position: Math.round(position) };
        if (axis === 'vertical') {
            this.guides.vertical.push(guide.position);
        } else {
            this.guides.horizontal.push(guide.position);
        }
        this.recordHistory('Add Guide');
        this.render();
        return guide;
    }

    removeGuide(guideOrPosition, axis) {
        if (this.locksGuides) return false;
        let pos = typeof guideOrPosition === 'object' ? guideOrPosition.position : guideOrPosition;
        let ax = typeof guideOrPosition === 'object' ? guideOrPosition.axis : axis;
        if (ax === 'vertical') {
            const idx = this.guides.vertical.indexOf(pos);
            if (idx !== -1) {
                this.guides.vertical.splice(idx, 1);
                this.recordHistory('Remove Guide');
                this.render();
                return true;
            }
        } else if (ax === 'horizontal') {
            const idx = this.guides.horizontal.indexOf(pos);
            if (idx !== -1) {
                this.guides.horizontal.splice(idx, 1);
                this.recordHistory('Remove Guide');
                this.render();
                return true;
            }
        }
        return false;
    }

    clearGuides() {
        // Clear Guides works even when locked (matching GuideTests.swift)
        this.guides.horizontal = [];
        this.guides.vertical = [];
        this.recordHistory('Clear Guides');
        this.render();
    }

    cropSnapTargets() {
        if (!this.snapEnabled) return { xs: [], ys: [] };
        const xs = new Set();
        const ys = new Set();

        if (this.snapToDocumentBounds) {
            xs.add(0);
            xs.add(this.width);
            ys.add(0);
            ys.add(this.height);
        }

        if (this.snapToLayers) {
            for (const l of this.layers) {
                if (!l.visible) continue;
                xs.add(l.x);
                xs.add(l.x + l.width);
                ys.add(l.y);
                ys.add(l.y + l.height);
            }
        }

        if (this.snapToGuides && this.showGuides) {
            for (const v of this.guides.vertical) xs.add(v);
            for (const h of this.guides.horizontal) ys.add(h);
        }

        if (this.snapToGrid && this.showGrid) {
            for (let x = 0; x <= this.width; x += 8) xs.add(x);
            for (let y = 0; y <= this.height; y += 8) ys.add(y);
        }

        return { xs: Array.from(xs).sort((a, b) => a - b), ys: Array.from(ys).sort((a, b) => a - b) };
    }

    transformSnapTargets(excluding = []) {
        if (!this.snapEnabled) return { xs: [], ys: [] };
        const snap = this.cropSnapTargets();
        const xs = new Set(snap.xs);
        const ys = new Set(snap.ys);

        if (this.snapToDocumentBounds) {
            xs.add(Math.round(this.width / 2));
            ys.add(Math.round(this.height / 2));
        }

        if (this.snapToLayers) {
            for (const l of this.layers) {
                if (!l.visible || excluding.includes(l.id)) continue;
                xs.add(Math.round(l.x + l.width / 2));
                ys.add(Math.round(l.y + l.height / 2));
            }
        }

        return { xs: Array.from(xs).sort((a, b) => a - b), ys: Array.from(ys).sort((a, b) => a - b) };
    }

    // --- Clone Stamp & Spot Healing Pipeline ---

    setCloneSource(x, y) {
        this.samplePoint = { x: Math.round(x), y: Math.round(y) };
        this.cloneOffset = null;
    }

    applyCloneStampStroke(startX, startY, endX = startX, endY = startY) {
        const layer = this.getActiveLayer();
        if (!layer) return false;
        if (!this.samplePoint) {
            throw new Error('Clone Stamp requires a source point. Set sample point first.');
        }

        let offset;
        if (this.cloneSettings.aligned) {
            if (!this.cloneOffset) {
                this.cloneOffset = { x: startX - this.samplePoint.x, y: startY - this.samplePoint.y };
            }
            offset = this.cloneOffset;
        } else {
            offset = { x: startX - this.samplePoint.x, y: startY - this.samplePoint.y };
        }

        const sourceX = startX - offset.x;
        const sourceY = startY - offset.y;

        const srcData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const dstData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const radius = Math.round(this.toolSettings.cloneStamp.size / 2);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const tx = Math.round(startX + dx);
                    const ty = Math.round(startY + dy);
                    const sx = Math.round(sourceX + dx);
                    const sy = Math.round(sourceY + dy);

                    if (tx >= 0 && tx < layer.width && ty >= 0 && ty < layer.height &&
                        sx >= 0 && sx < layer.width && sy >= 0 && sy < layer.height) {
                        const sIdx = (sy * layer.width + sx) * 4;
                        const dIdx = (ty * layer.width + tx) * 4;
                        dstData.data[dIdx] = srcData.data[sIdx];
                        dstData.data[dIdx + 1] = srcData.data[sIdx + 1];
                        dstData.data[dIdx + 2] = srcData.data[sIdx + 2];
                        dstData.data[dIdx + 3] = srcData.data[sIdx + 3];
                    }
                }
            }
        }

        layer.ctx.putImageData(dstData, 0, 0);
        this.recordHistory('Clone Stamp');
        this.render();
        return true;
    }

    applySpotHealing(targetX, targetY, radius = 12) {
        const layer = this.getActiveLayer();
        if (!layer) return false;

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        const data = imgData.data;
        const w = layer.width, h = layer.height;

        // Collect boundary pixel colors just outside radius
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        const outerR = radius + 2;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
            const bx = Math.round(targetX + Math.cos(angle) * outerR);
            const by = Math.round(targetY + Math.sin(angle) * outerR);
            if (bx >= 0 && bx < w && by >= 0 && by < h) {
                const idx = (by * w + bx) * 4;
                if (data[idx + 3] > 0) {
                    sumR += data[idx];
                    sumG += data[idx + 1];
                    sumB += data[idx + 2];
                    count++;
                }
            }
        }

        const avgR = count > 0 ? Math.round(sumR / count) : 128;
        const avgG = count > 0 ? Math.round(sumG / count) : 128;
        const avgB = count > 0 ? Math.round(sumB / count) : 128;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distSq = dx * dx + dy * dy;
                if (distSq <= radius * radius) {
                    const px = Math.round(targetX + dx);
                    const py = Math.round(targetY + dy);
                    if (px >= 0 && px < w && py >= 0 && py < h) {
                        const idx = (py * w + px) * 4;
                        const weight = Math.min(1.0, 1.2 * (1.0 - Math.sqrt(distSq) / radius));
                        data[idx] = Math.round(data[idx] * (1 - weight) + avgR * weight);
                        data[idx + 1] = Math.round(data[idx + 1] * (1 - weight) + avgG * weight);
                        data[idx + 2] = Math.round(data[idx + 2] * (1 - weight) + avgB * weight);
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        layer.ctx.putImageData(imgData, 0, 0);
        this.recordHistory('Spot Healing');
        this.render();
        return true;
    }

    // --- Vector Shapes Pipeline ---

    addShapeLayer(type, rect = {}, options = {}) {
        const x = rect.x !== undefined ? rect.x : 0;
        const y = rect.y !== undefined ? rect.y : 0;
        const width = rect.width !== undefined ? rect.width : 100;
        const height = rect.height !== undefined ? rect.height : 100;
        const cornerRadius = options.cornerRadius || 0;
        const fill = options.fill !== undefined ? options.fill : true;
        const stroke = options.stroke !== undefined ? options.stroke : false;
        const strokeWidth = options.strokeWidth || 2;
        const color = options.color || this.foregroundColor;

        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        const layerName = `${typeCap} ${this.shapeLayerCounter++}`;
        const layer = this.createLayer(layerName, width, height);
        layer.x = x;
        layer.y = y;
        layer.width = width;
        layer.height = height;

        const ctx = layer.ctx;
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = options.strokeColor || this.backgroundColor;
        ctx.lineWidth = strokeWidth;

        if (type === 'ellipse') {
            const rx = width / 2;
            const ry = height / 2;
            ctx.beginPath();
            ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        } else if (type === 'rounded' || cornerRadius > 0) {
            const maxR = Math.min(width, height) / 2;
            const effectiveR = Math.min(cornerRadius, maxR);
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(0, 0, width, height, effectiveR);
            } else {
                ctx.rect(0, 0, width, height);
            }
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
            layer.shapeCornerRadius = effectiveR;
        } else {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        }

        ctx.restore();
        layer.shapeType = type;

        const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (activeIdx !== -1) {
            this.layers.splice(activeIdx + 1, 0, layer);
        } else {
            this.layers.push(layer);
        }
        this.activeLayerId = layer.id;
        this.recordHistory('Shape');
        this.render();
        this.notifyUI();
        return layer;
    }

    // --- Live Text Pipeline ---

    addTextLayer(options = {}) {
        const text = options.text || 'Text';
        const x = options.x !== undefined ? options.x : 0;
        const y = options.y !== undefined ? options.y : 0;
        const fontSize = options.fontSize || 48;
        const font = options.font || 'Segoe UI';
        const color = options.color || this.foregroundColor;
        const alignment = options.alignment || 'left';
        const tracking = options.tracking || 0;
        const boxSize = options.boxSize || null;

        const layer = this.createLayer(`Text - ${text.substring(0, 12)}`, 100, 40);
        layer.x = x;
        layer.y = y;
        layer.liveText = {
            content: text,
            font,
            fontSize,
            color,
            alignment,
            tracking,
            boxSize
        };

        this.renderTextLayerCanvas(layer);

        const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (activeIdx !== -1) {
            this.layers.splice(activeIdx + 1, 0, layer);
        } else {
            this.layers.push(layer);
        }
        this.activeLayerId = layer.id;
        this.recordHistory('Add Text');
        this.render();
        this.notifyUI();
        return layer;
    }

    editTextLayer(layerId, newContent, newStyle = {}) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.liveText) return false;

        layer.liveText.content = newContent;
        Object.assign(layer.liveText, newStyle);
        this.renderTextLayerCanvas(layer);
        this.recordHistory('Edit Text');
        this.render();
        return true;
    }

    renderTextLayerCanvas(layer) {
        const t = layer.liveText;
        const w = t.boxSize ? t.boxSize.width : Math.max(100, Math.round(t.content.length * t.fontSize * 0.7));
        const h = t.boxSize ? t.boxSize.height : Math.max(40, Math.round(t.fontSize * 1.5));

        layer.width = w;
        layer.height = h;
        layer.canvas = this.createCanvas(w, h);
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });

        const ctx = layer.ctx;
        ctx.save();
        ctx.font = `${t.fontSize}px ${t.font}`;
        ctx.fillStyle = t.color;
        ctx.textAlign = t.alignment;
        ctx.textBaseline = 'top';

        const drawX = t.alignment === 'right' ? w : (t.alignment === 'center' ? w / 2 : 0);
        ctx.fillText(t.content, drawX, 0);
        ctx.restore();
    }

    // --- Outer Glow & Layer Effects ---

    validateOuterGlow(effect) {
        if (!effect || typeof effect !== 'object') return false;
        if (typeof effect.size !== 'number' || effect.size < 0) return false;
        if (typeof effect.opacity !== 'number' || effect.opacity < 0 || effect.opacity > 1) return false;
        if (effect.red !== undefined && (effect.red < 0 || effect.red > 1)) return false;
        if (effect.green !== undefined && (effect.green < 0 || effect.green > 1)) return false;
        if (effect.blue !== undefined && (effect.blue < 0 || effect.blue > 1)) return false;
        return true;
    }

    setOuterGlow(layerId, effect) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;
        if (effect === null) {
            if (layer.effects) delete layer.effects.outerGlow;
            this.recordHistory('Remove Outer Glow');
            this.render();
            return true;
        }
        if (!this.validateOuterGlow(effect)) {
            throw new Error('Invalid Outer Glow effect parameters');
        }
        layer.effects = layer.effects || {};
        layer.effects.outerGlow = { ...effect };
        this.recordHistory('Layer Effect: Outer Glow');
        this.render();
        return true;
    }

    validateInnerGlow(effect) {
        if (!effect || typeof effect !== 'object') return false;
        if (typeof effect.size !== 'number' || effect.size < 0 || effect.size > 500) return false;
        if (typeof effect.opacity !== 'number' || effect.opacity < 0 || effect.opacity > 1) return false;
        if (effect.red !== undefined && (typeof effect.red !== 'number' || effect.red < 0 || effect.red > 1)) return false;
        if (effect.green !== undefined && (typeof effect.green !== 'number' || effect.green < 0 || effect.green > 1)) return false;
        if (effect.blue !== undefined && (typeof effect.blue !== 'number' || effect.blue < 0 || effect.blue > 1)) return false;
        return true;
    }

    setInnerGlow(layerId, effect) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return false;
        if (effect === null) {
            if (layer.effects) delete layer.effects.innerGlow;
            this.recordHistory('Remove Inner Glow');
            this.render();
            return true;
        }
        if (!this.validateInnerGlow(effect)) {
            throw new Error('Invalid Inner Glow effect parameters');
        }
        layer.effects = layer.effects || {};
        layer.effects.innerGlow = {
            enabled: effect.enabled !== false,
            size: effect.size !== undefined ? effect.size : 10,
            opacity: effect.opacity !== undefined ? effect.opacity : 0.75,
            red: effect.red !== undefined ? effect.red : 1.0,
            green: effect.green !== undefined ? effect.green : 1.0,
            blue: effect.blue !== undefined ? effect.blue : 1.0
        };
        this.recordHistory('Layer Effect: Inner Glow');
        this.render();
        return true;
    }

    // --- Export Pipeline ---

    exportPNG() {
        if (this.width > 30000 || this.height > 30000) {
            throw new Error('Canvas size exceeds maximum export dimensions of 30,000 pixels');
        }

        const outCanvas = this.createCanvas(this.width, this.height);
        const outCtx = outCanvas.getContext('2d');

        for (const layer of this.layers) {
            if (!layer.visible) continue;
            outCtx.save();
            outCtx.globalAlpha = layer.opacity;
            outCtx.globalCompositeOperation = this.mapBlendMode(layer.blendMode);
            outCtx.drawImage(layer.canvas, layer.x, layer.y);
            outCtx.restore();
        }

        return {
            width: this.width,
            height: this.height,
            format: 'image/png',
            canvas: outCanvas,
            dataUrl: outCanvas.toDataURL ? outCanvas.toDataURL('image/png') : null
        };
    }

    exportJPEG(options = {}) {
        if (this.width > 30000 || this.height > 30000) {
            throw new Error('Canvas size exceeds maximum export dimensions of 30,000 pixels');
        }

        const quality = options.quality !== undefined ? options.quality : 0.92;
        const matte = options.matte || '#ffffff';

        const outCanvas = this.createCanvas(this.width, this.height);
        const outCtx = outCanvas.getContext('2d');

        // Draw matte background
        outCtx.fillStyle = matte;
        outCtx.fillRect(0, 0, this.width, this.height);

        for (const layer of this.layers) {
            if (!layer.visible) continue;
            outCtx.save();
            outCtx.globalAlpha = layer.opacity;
            outCtx.globalCompositeOperation = this.mapBlendMode(layer.blendMode);
            outCtx.drawImage(layer.canvas, layer.x, layer.y);
            outCtx.restore();
        }

        return {
            width: this.width,
            height: this.height,
            format: 'image/jpeg',
            quality,
            matte,
            canvas: outCanvas,
            dataUrl: outCanvas.toDataURL ? outCanvas.toDataURL('image/jpeg', quality) : null
        };
    }

    // --- Selection Clipboard & Feathering ---

    copySelection() {
        const layer = this.getActiveLayer();
        if (!layer || !this.selection) return null;

        const bounds = this.selection.bounds || { x: 0, y: 0, width: this.width, height: this.height };
        const clipCanvas = this.createCanvas(bounds.width, bounds.height);
        const clipCtx = clipCanvas.getContext('2d');

        clipCtx.drawImage(layer.canvas, bounds.x - layer.x, bounds.y - layer.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        this.clipboard = {
            width: bounds.width,
            height: bounds.height,
            canvas: clipCanvas,
            x: bounds.x,
            y: bounds.y
        };
        return this.clipboard;
    }

    cutSelection() {
        const clip = this.copySelection();
        if (!clip) return null;

        const layer = this.getActiveLayer();
        const bounds = this.selection.bounds || { x: 0, y: 0, width: this.width, height: this.height };
        layer.ctx.clearRect(bounds.x - layer.x, bounds.y - layer.y, bounds.width, bounds.height);

        this.recordHistory('Cut');
        this.render();
        return clip;
    }

    pasteSelection() {
        if (!this.clipboard) return null;
        const newLayer = this.createLayer('Pasted Layer', this.clipboard.width, this.clipboard.height);
        newLayer.x = this.clipboard.x || 0;
        newLayer.y = this.clipboard.y || 0;
        newLayer.width = this.clipboard.width;
        newLayer.height = this.clipboard.height;
        newLayer.canvas = this.clipboard.canvas;
        newLayer.ctx = newLayer.canvas.getContext('2d');

        const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (activeIdx !== -1) {
            this.layers.splice(activeIdx + 1, 0, newLayer);
        } else {
            this.layers.push(newLayer);
        }
        this.activeLayerId = newLayer.id;
        this.recordHistory('Paste');
        this.render();
        this.notifyUI();
        return newLayer;
    }

    featherSelection(radius = 5) {
        if (!this.selection || !this.selection.mask) return;
        const w = this.selection.width, h = this.selection.height;
        const original = this.selection.mask;
        const feathered = new Uint8Array(w * h);

        const r = Math.max(1, Math.round(radius));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, cnt = 0;
                for (let kx = -r; kx <= r; kx++) {
                    const nx = x + kx;
                    if (nx >= 0 && nx < w) {
                        sum += original[y * w + nx];
                        cnt++;
                    }
                }
                feathered[y * w + x] = Math.round(sum / cnt);
            }
        }
        this.selection.mask = feathered;
        this.selection.feather = radius;
    }

    static createHeadless(width = 800, height = 600) {
        const dummyCanvas = createMockCanvas(width, height);
        const dummyOverlay = createMockCanvas(width, height);
        const eng = new CompositorEngine(dummyCanvas, dummyOverlay);
        eng.isHeadless = true;
        eng.newCanvas(width, height, 'transparent');
        eng.width = width;
        eng.height = height;
        return eng;
    }
}

CompositorEngine.createMockCanvas = createMockCanvas;

if (typeof module !== 'undefined') {
    module.exports = CompositorEngine;
}

