/**
 * Compositor Project (.comp) Serialization & Image Export/Import
 * Matches manifest v1-v6 specification from docs/project-format.md
 */

class ProjectStore {
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Packs the current project state into a .comp package (ZIP format)
     */
    static async serializeProject(project, JSZip) {
        const zip = new JSZip();
        const imagesFolder = zip.folder("images");

        const manifest = {
            format: "com.compositor.project",
            version: 6,
            uuid: project.uuid || this.generateUUID(),
            dimensions: {
                width: project.width,
                height: project.height
            },
            resolution: project.resolution || 72,
            activeLayerUUID: project.activeLayerId,
            layers: []
        };

        for (const layer of project.layers) {
            const layerRecord = {
                uuid: layer.id,
                name: layer.name,
                visible: layer.visible,
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
     * Unpacks a .comp package and reconstructs the document and layers
     */
    static async deserializeProject(base64Zip, JSZip) {
        const zip = await JSZip.loadAsync(base64Zip, { base64: true });
        const manifestFile = zip.file("manifest.json");
        if (!manifestFile) {
            throw new Error("Invalid Compositor file: missing manifest.json");
        }

        const manifestText = await manifestFile.async("string");
        const manifest = JSON.parse(manifestText);

        const project = {
            uuid: manifest.uuid,
            width: manifest.dimensions.width,
            height: manifest.dimensions.height,
            resolution: manifest.resolution || 72,
            activeLayerId: manifest.activeLayerUUID,
            layers: []
        };

        for (const record of manifest.layers) {
            const layer = {
                id: record.uuid,
                name: record.name,
                visible: record.visible !== false,
                opacity: record.opacity !== undefined ? record.opacity : 1.0,
                blendMode: record.blendMode || "Normal",
                x: record.transform?.x || 0,
                y: record.transform?.y || 0,
                width: record.transform?.width || project.width,
                height: record.transform?.height || project.height,
                rotation: record.transform?.rotation || 0,
                flipX: !!record.transform?.flipX,
                flipY: !!record.transform?.flipY,
                isGroup: !!record.isGroup,
                parentId: record.parentID || null,
                maskSourceId: record.maskSourceID || null,
                hasMask: !!record.maskFile,
                maskEnabled: record.maskEnabled !== false
            };

            // Reconstruct layer canvas from PNG asset
            if (record.imageFile) {
                const imgFile = zip.file(`images/${record.imageFile}`) || zip.file(record.imageFile);
                if (imgFile) {
                    const imgBase64 = await imgFile.async("base64");
                    const img = await this.loadImage(`data:image/png;base64,${imgBase64}`);
                    const canvas = document.createElement('canvas');
                    canvas.width = layer.width;
                    canvas.height = layer.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, layer.width, layer.height);
                    layer.canvas = canvas;
                    layer.ctx = ctx;
                }
            } else if (!layer.isGroup) {
                // Blank layer
                const canvas = document.createElement('canvas');
                canvas.width = layer.width;
                canvas.height = layer.height;
                layer.canvas = canvas;
                layer.ctx = canvas.getContext('2d');
            }

            // Reconstruct mask canvas
            if (record.maskFile) {
                const maskFile = zip.file(`images/${record.maskFile}`) || zip.file(record.maskFile);
                if (maskFile) {
                    const maskBase64 = await maskFile.async("base64");
                    const maskImg = await this.loadImage(`data:image/png;base64,${maskBase64}`);
                    const maskCanvas = document.createElement('canvas');
                    maskCanvas.width = layer.width;
                    maskCanvas.height = layer.height;
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
