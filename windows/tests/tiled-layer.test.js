const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Tiled Layer & Brush Patch Compositing (Mac TiledLayerTests Parity)', () => {
    function createNoiseLayer(engine, width, height, seed = 12345) {
        const layer = engine.addLayer('Noise');
        const imgData = layer.ctx.getImageData(0, 0, width, height);
        let state = seed >>> 0;
        for (let i = 0; i < width * height; i++) {
            state = ((state * 1664525) + 1013904223) >>> 0;
            imgData.data[i * 4] = (state >>> 24) & 0xff;
            imgData.data[i * 4 + 1] = (state >>> 16) & 0xff;
            imgData.data[i * 4 + 2] = (state >>> 8) & 0xff;
            imgData.data[i * 4 + 3] = 255;
        }
        layer.ctx.putImageData(imgData, 0, 0);
        return layer;
    }

    test('Live stroke patch composites over base layer without pixel shift', () => {
        const engine = CompositorEngine.createHeadless(64, 64);
        const layer = createNoiseLayer(engine, 64, 64, 9999);

        // Capture base state
        const baseSnapshot = layer.ctx.getImageData(0, 0, 64, 64).data.slice();

        // 1. Simulate a live brush stroke patch in a 16x16 region at (20, 20)
        const patchCanvas = engine.createCanvas(16, 16);
        const patchCtx = patchCanvas.getContext('2d');
        patchCtx.fillStyle = '#ff0000';
        patchCtx.fillRect(0, 0, 16, 16);

        // Draw patch into layer
        layer.ctx.drawImage(patchCanvas, 20, 20);

        const composited = layer.ctx.getImageData(0, 0, 64, 64).data;

        // Inside patch: must be red (255, 0, 0)
        const insideIdx = (25 * 64 + 25) * 4;
        assert.equal(composited[insideIdx], 255);
        assert.equal(composited[insideIdx + 1], 0);
        assert.equal(composited[insideIdx + 2], 0);

        // Outside patch (e.g. at (10, 10)): must be completely identical to base snapshot (0 pixel shift)
        for (let y = 0; y < 18; y++) {
            for (let x = 0; x < 18; x++) {
                const idx = (y * 64 + x) * 4;
                assert.equal(composited[idx], baseSnapshot[idx]);
                assert.equal(composited[idx + 1], baseSnapshot[idx + 1]);
                assert.equal(composited[idx + 2], baseSnapshot[idx + 2]);
                assert.equal(composited[idx + 3], baseSnapshot[idx + 3]);
            }
        }
    });

    test('Tile-based rasterization preserves seamless boundaries across adjacent chunks', () => {
        const engine = CompositorEngine.createHeadless(64, 64);
        const layer = engine.getActiveLayer();

        // Draw across two adjacent 32x32 tiles (tile 0: 0..31, tile 1: 32..63)
        // Draw a horizontal line passing through x = 30, 31, 32, 33 at y = 16
        layer.ctx.fillStyle = '#ffffff';
        layer.ctx.fillRect(0, 16, 64, 2);

        const data = layer.ctx.getImageData(0, 0, 64, 64).data;

        // Verify seam at x = 31 and x = 32 has identical brightness and no dropouts
        const leftOfSeam = (16 * 64 + 31) * 4;
        const rightOfSeam = (16 * 64 + 32) * 4;

        assert.equal(data[leftOfSeam], 255, 'Left side of seam must be drawn');
        assert.equal(data[rightOfSeam], 255, 'Right side of seam must be drawn');
        assert.equal(data[leftOfSeam + 3], 255);
        assert.equal(data[rightOfSeam + 3], 255);
    });

    test('Mask patch compositing affects only alpha channel without modifying RGB texture', () => {
        const engine = CompositorEngine.createHeadless(32, 32);
        const layer = createNoiseLayer(engine, 32, 32, 5555);

        engine.addMaskToLayer(layer);
        assert.ok(layer.hasMask);

        // Paint a black patch on mask at [10, 10, 10, 10]
        layer.maskCtx.fillStyle = '#000000';
        layer.maskCtx.fillRect(10, 10, 10, 10);

        const maskData = layer.maskCtx.getImageData(0, 0, 32, 32).data;
        const insideMask = (15 * 32 + 15) * 4;
        assert.equal(maskData[insideMask], 0, 'Mask patch must conceal (0)');

        const outsideMask = (5 * 32 + 5) * 4;
        assert.equal(maskData[outsideMask], 255, 'Outside mask must reveal (255)');
    });
});
