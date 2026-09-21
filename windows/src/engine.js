/**
 * Compositor Engine for Windows
 * Comprehensive Canvas, Layer, Tool, Adjustment & Selection Pipeline
 */

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
            brush: { size: 30, hardness: 80, opacity: 100 },
            eraser: { size: 30, hardness: 80, opacity: 100 },
            marquee: { type: 'rect', feather: 0 },
            lasso: { type: 'freehand' },
            wand: { tolerance: 32, contiguous: true },
            gradient: { type: 'linear' },
            shape: { type: 'rectangle', fill: true, stroke: false, strokeWidth: 2, radius: 10 },
            type: { text: 'Compositor', font: 'Segoe UI', size: 48, bold: false, italic: false },
            crop: { aspect: 'free' }
        };

        // Palette
        this.foregroundColor = '#ffffff';
        this.backgroundColor = '#000000';

        // Selection
        this.selection = null; // { mask: Uint8Array, width, height, bounds: {x0, y0, x1, y1} }
        this.selectionPath = null;
        this.selectionOffset = 0; // for marching ants

        // Guides and Snapping
        this.guides = { horizontal: [], vertical: [] };
        this.showRulers = true;
        this.showGuides = true;
        this.showGrid = false;
        this.snapEnabled = true;

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
        this.width = Math.max(10, Math.min(width, 10000));
        this.height = Math.max(10, Math.min(height, 10000));
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
        const canvas = document.createElement('canvas');
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

    deleteActiveLayer() {
        if (this.layers.length <= 1) return;
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx !== -1) {
            this.layers.splice(idx, 1);
            const nextIdx = Math.max(0, idx - 1);
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

        const tempCanvas = document.createElement('canvas');
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
        const flatCanvas = document.createElement('canvas');
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
        layer.maskCanvas = document.createElement('canvas');
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
            case 'Soft Light': return 'soft-light';
            case 'Hard Light': return 'hard-light';
            default: return 'source-over';
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.visible) continue;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
            this.ctx.globalCompositeOperation = this.mapBlendMode(layer.blendMode);

            // Layer Transformations
            const cx = layer.x + layer.width / 2;
            const cy = layer.y + layer.height / 2;
            this.ctx.translate(cx, cy);
            if (layer.rotation) this.ctx.rotate((layer.rotation * Math.PI) / 180);
            this.ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
            this.ctx.translate(-cx, -cy);

            if (layer.hasMask && layer.maskEnabled && layer.maskCanvas) {
                // Render layer with mask
                const tempCanvas = document.createElement('canvas');
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
        const loop = () => {
            if (this.selection) {
                this.selectionOffset = (this.selectionOffset + 0.5) % 8;
                this.renderOverlay();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
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
                    this.drawBrushLine(this.lastPointer.x, this.lastPointer.y, docX, docY, false);
                    this.render();
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

        const tempCanvas = document.createElement('canvas');
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
        this.selection = {
            type: isEllipse ? 'ellipse' : 'rect',
            bounds: { x, y, width: w, height: h }
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
        const tempCanvas = document.createElement('canvas');
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
            layers: this.layers.map(l => {
                const copyCanvas = document.createElement('canvas');
                copyCanvas.width = l.width;
                copyCanvas.height = l.height;
                copyCanvas.getContext('2d').drawImage(l.canvas, 0, 0);

                let maskCopy = null;
                if (l.hasMask && l.maskCanvas) {
                    maskCopy = document.createElement('canvas');
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
                    maskSourceId: l.maskSourceId
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
        this.layers = snapshot.layers.map(l => {
            const canvas = document.createElement('canvas');
            canvas.width = l.width;
            canvas.height = l.height;
            canvas.getContext('2d').drawImage(l.canvas, 0, 0);

            let maskCanvas = null;
            if (l.hasMask && l.maskCanvas) {
                maskCanvas = document.createElement('canvas');
                maskCanvas.width = l.width;
                maskCanvas.height = l.height;
                maskCanvas.getContext('2d').drawImage(l.maskCanvas, 0, 0);
            }

            return {
                ...l,
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

    notifyStatus(msg) {
        if (this.onStatusChange) this.onStatusChange(msg);
    }

    hexToRgb(hex) {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
}

if (typeof module !== 'undefined') {
    module.exports = CompositorEngine;
}
