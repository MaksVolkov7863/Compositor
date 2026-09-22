let mockCanvasFactory = null;
if (typeof require !== 'undefined') {
    try {
        const engine = require('./engine.js');
        if (engine && engine.createMockCanvas) {
            mockCanvasFactory = engine.createMockCanvas;
        }
    } catch (_) {}
}

class ProjectStore {
    static createCanvas(w, h) {
        if (typeof document !== 'undefined' && document.createElement) {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            return canvas;
        }
        if (mockCanvasFactory) {
            return mockCanvasFactory(w, h);
        }
        // Minimal fallback canvas
        return {
            width: w,
            height: h,
            getContext: () => ({
                drawImage: () => {},
                fillRect: () => {},
                clearRect: () => {},
                getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
                putImageData: () => {}
            }),
            toDataURL: () => 'data:image/png;base64,'
        };
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Packs the current project state into a .comp package (ZIP format)
     * Writes Manifest version 9.
     */
    static async serializeProject(project, JSZip) {
        const zip = new JSZip();
        const imagesFolder = zip.folder("images");

        const manifest = {
            format: "com.compositor.project",
            version: 9,
            colorSpace: "sRGB",
            uuid: project.uuid || this.generateUUID(),
            dimensions: {
                width: project.width,
                height: project.height
            },
            resolution: project.resolution || 72,
            activeLayerUUID: project.activeLayerId,
            layers: []
        };

        // Serialize guides (CanvasGuide array format or object)
        if (project.guides) {
            manifest.guides = [];
            if (Array.isArray(project.guides)) {
                manifest.guides = project.guides.map(g => ({
                    id: g.id || this.generateUUID(),
                    axis: g.axis,
                    position: g.position
                }));
            } else if (typeof project.guides === 'object') {
                if (Array.isArray(project.guides.horizontal)) {
                    for (const pos of project.guides.horizontal) {
                        manifest.guides.push({ id: this.generateUUID(), axis: 'horizontal', position: pos });
                    }
                }
                if (Array.isArray(project.guides.vertical)) {
                    for (const pos of project.guides.vertical) {
                        manifest.guides.push({ id: this.generateUUID(), axis: 'vertical', position: pos });
                    }
                }
            }
        }

        for (const layer of project.layers) {
            const layerRecord = {
                uuid: layer.id,
                name: layer.name,
                visible: layer.visible !== false,
                opacity: layer.opacity !== undefined ? layer.opacity : 1.0,
                blendMode: layer.blendMode || "Normal",
                transform: {
                    x: layer.x || 0,
                    y: layer.y || 0,
                    width: layer.width,
                    height: layer.height,
                    rotation: layer.rotation || 0,
                    flipX: !!layer.flipX,
                    flipY: !!layer.flipY
                }
            };

            if (layer.isGroup) {
                layerRecord.isGroup = true;
            }
            if (layer.parentId) {
                layerRecord.parentID = layer.parentId;
            }
            if (layer.maskSourceId) {
                layerRecord.maskSourceID = layer.maskSourceId;
            }

            // Adjustment layers (manifest v7+)
            if (layer.adjustment) {
                layerRecord.adjustment = layer.adjustment;
            }

            // Editable Vector Shape metadata
            if (layer.shape || layer.shapeType) {
                layerRecord.shape = layer.shape || {
                    kind: layer.shapeType || 'rectangle',
                    cornerRadius: layer.shapeCornerRadius || 0
                };
            }

            // Editable Text metadata
            if (layer.liveText || layer.text) {
                const textObj = layer.liveText || layer.text;
                layerRecord.text = {
                    content: textObj.content || textObj.text || 'Text',
                    fontName: textObj.font || textObj.fontName || 'Segoe UI',
                    fontSize: textObj.fontSize || 48,
                    alignment: textObj.alignment || 'left',
                    tracking: textObj.tracking || 0,
                    leading: textObj.leading || 0,
                    boxSize: textObj.boxSize || null
                };
            }

            // Layer Effects (Stroke, Shadow, Outer Glow, Color Overlay, Inner Shadow)
            if (layer.effects && Object.keys(layer.effects).length > 0) {
                layerRecord.effects = layer.effects;
            }

            // Save raster image data if layer has canvas
            if (!layer.isGroup && layer.canvas) {
                const imageFilename = `${layer.id}.png`;
                const dataUrl = layer.canvas.toDataURL('image/png');
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                imagesFolder.file(imageFilename, base64Data, { base64: true });
                layerRecord.imageFile = imageFilename;
            }

            // Save mask image data if present
            if (layer.maskCanvas && layer.hasMask) {
                const maskFilename = `${layer.id}.mask.png`;
                const maskDataUrl = layer.maskCanvas.toDataURL('image/png');
                const maskBase64 = maskDataUrl.replace(/^data:image\/png;base64,/, '');
                imagesFolder.file(maskFilename, maskBase64, { base64: true });
                layerRecord.maskFile = maskFilename;
                layerRecord.maskEnabled = layer.maskEnabled !== false;
            }

            manifest.layers.push(layerRecord);
        }

        zip.file("manifest.json", JSON.stringify(manifest, null, 2));
        const content = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
        return content;
    }

    /**
     * Unpacks a .comp package and reconstructs the document and layers.
     * Supports manifest versions 1 through 9.
     */
    static async deserializeProject(base64Zip, JSZip) {
        const zip = await JSZip.loadAsync(base64Zip, { base64: true });
        const manifestFile = zip.file("manifest.json");
        if (!manifestFile) {
            throw new Error("Invalid Compositor file: missing manifest.json");
        }

        const manifestText = await manifestFile.async("string");
        const manifest = JSON.parse(manifestText);

        if (manifest.format !== "com.compositor.project") {
            throw new Error(`Invalid Compositor project format: ${manifest.format}`);
        }

        const version = typeof manifest.version === 'number' ? manifest.version : parseInt(manifest.version, 10);
        if (isNaN(version) || version < 1 || version > 9) {
            throw new Error(`Unsupported project format version: ${manifest.version}. This app supports versions 1–9.`);
        }

        const width = manifest.dimensions ? manifest.dimensions.width : manifest.width;
        const height = manifest.dimensions ? manifest.dimensions.height : manifest.height;

        const project = {
            uuid: manifest.uuid || manifest.documentID || this.generateUUID(),
            version: version,
            width: width,
            height: height,
            resolution: manifest.resolution || 72,
            activeLayerId: manifest.activeLayerUUID || manifest.activeLayerID,
            guides: { horizontal: [], vertical: [] },
            layers: []
        };

        // Restore alignment guides if present (manifest v8+)
        if (Array.isArray(manifest.guides)) {
            for (const g of manifest.guides) {
                if (g.axis === 'horizontal') {
                    project.guides.horizontal.push(g.position);
                } else if (g.axis === 'vertical') {
                    project.guides.vertical.push(g.position);
                }
            }
        }

        const layersList = manifest.layers || [];
        for (const record of layersList) {
            const layerTransform = record.transform || {};
            const layerWidth = layerTransform.width || project.width;
            const layerHeight = layerTransform.height || project.height;

            const layer = {
                id: record.uuid || record.id,
                name: record.name,
                visible: record.visible !== undefined ? record.visible : (record.isVisible !== false),
                opacity: record.opacity !== undefined ? record.opacity : 1.0,
                blendMode: record.blendMode || "Normal",
                x: layerTransform.x !== undefined ? layerTransform.x : (layerTransform.origin?.x || 0),
                y: layerTransform.y !== undefined ? layerTransform.y : (layerTransform.origin?.y || 0),
                width: layerWidth,
                height: layerHeight,
                rotation: layerTransform.rotation || 0,
                flipX: !!layerTransform.flipX,
                flipY: !!layerTransform.flipY,
                isGroup: !!record.isGroup,
                parentId: record.parentID || record.parentId || null,
                maskSourceId: record.maskSourceID || record.maskSourceId || null,
                hasMask: !!record.maskFile,
                maskEnabled: record.maskEnabled !== false,
                adjustment: record.adjustment || null,
                shape: record.shape || null,
                shapeType: record.shape ? record.shape.kind : null,
                shapeCornerRadius: record.shape ? (record.shape.cornerRadius || 0) : 0,
                effects: record.effects || null
            };

            // Reconstruct text style
            if (record.text) {
                layer.liveText = {
                    content: record.text.content || 'Text',
                    font: record.text.fontName || 'Segoe UI',
                    fontSize: record.text.fontSize || 48,
                    alignment: record.text.alignment || 'left',
                    tracking: record.text.tracking || 0,
                    leading: record.text.leading || 0,
                    boxSize: record.text.boxSize || null
                };
            }

            // Reconstruct layer canvas from PNG asset
            if (record.imageFile) {
                const imgFile = zip.file(`images/${record.imageFile}`) || zip.file(record.imageFile);
                if (imgFile) {
                    const imgBase64 = await imgFile.async("base64");
                    const img = await this.loadImage(`data:image/png;base64,${imgBase64}`);
                    const canvas = this.createCanvas(layer.width, layer.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, layer.width, layer.height);
                    layer.canvas = canvas;
                    layer.ctx = ctx;
                }
            } else if (!layer.isGroup) {
                // Blank layer
                const canvas = this.createCanvas(layer.width, layer.height);
                layer.canvas = canvas;
                layer.ctx = canvas.getContext('2d');
            }

            // Reconstruct mask canvas
            if (record.maskFile) {
                const maskFile = zip.file(`images/${record.maskFile}`) || zip.file(record.maskFile);
                if (maskFile) {
                    const maskBase64 = await maskFile.async("base64");
                    const maskImg = await this.loadImage(`data:image/png;base64,${maskBase64}`);
                    const maskCanvas = this.createCanvas(layer.width, layer.height);
                    const maskCtx = maskCanvas.getContext('2d');
                    maskCtx.drawImage(maskImg, 0, 0, layer.width, layer.height);
                    layer.maskCanvas = maskCanvas;
                    layer.maskCtx = maskCtx;
                }
            }

            project.layers.push(layer);
        }

        return project;
    }

    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error("Failed to load image asset: " + e));
            img.src = src;
        });
    }
}

if (typeof module !== 'undefined') {
    module.exports = ProjectStore;
}
