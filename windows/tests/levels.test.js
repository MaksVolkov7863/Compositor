const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Levels Adjustment & Histogram Pipeline', () => {
    test('Identity levels mapping preserves exact pixel values', () => {
        const engine = CompositorEngine.createHeadless(4, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 4, 1);
        
        imgData.data.set([
            0, 0, 0, 255,
            64, 64, 64, 255,
            128, 128, 128, 255,
            255, 255, 255, 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        engine.applyLevels(0, 1.0, 255, 0, 255);
        const result = ctx.getImageData(0, 0, 4, 1).data;

        assert.equal(result[0], 0);
        assert.equal(result[4], 64);
        assert.equal(result[8], 128);
        assert.equal(result[12], 255);
    });

    test('Input clipping at black and white points', () => {
        const engine = CompositorEngine.createHeadless(4, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 4, 1);
        
        imgData.data.set([
            32, 32, 32, 255,   // < 64 -> 0
            64, 64, 64, 255,   // == 64 -> 0
            128, 128, 128, 255, // == 128 -> 255
            200, 200, 200, 255  // > 128 -> 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        engine.applyLevels(64, 1.0, 128, 0, 255);
        const result = ctx.getImageData(0, 0, 4, 1).data;

        assert.equal(result[0], 0, 'Pixel below black point should be clipped to 0');
        assert.equal(result[4], 0, 'Pixel at black point should be 0');
        assert.equal(result[8], 255, 'Pixel at white point should be 255');
        assert.equal(result[12], 255, 'Pixel above white point should be clipped to 255');
    });

    test('Gamma adjustment curves midtones correctly', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        // 64 / 255 ~ 0.251. With gamma=2.0, sqrt(0.251) ~ 0.501 -> ~128
        imgData.data.set([
            64, 64, 64, 255,
            128, 128, 128, 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        engine.applyLevels(0, 2.0, 255, 0, 255);
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.ok(Math.abs(result[0] - 128) <= 2, `Expected ~128, got ${result[0]}`);
        assert.ok(Math.abs(result[4] - 181) <= 2, `Expected ~181, got ${result[4]}`);
    });

    test('Output levels inversion (negative / inverted film)', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        imgData.data.set([
            0, 0, 0, 255,
            255, 255, 255, 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        // Map 0..255 to 255..0
        engine.applyLevels(0, 1.0, 255, 255, 0);
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.equal(result[0], 255, 'Black input becomes white output');
        assert.equal(result[4], 0, 'White input becomes black output');
    });

    test('Transparent pixels are skipped and preserve alpha channel', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        imgData.data.set([
            120, 120, 120, 0,   // fully transparent
            100, 150, 200, 128  // partial alpha
        ]);
        ctx.putImageData(imgData, 0, 0);

        engine.applyLevels(0, 1.5, 255, 0, 255);
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.equal(result[3], 0, 'Alpha must remain 0 for fully transparent pixel');
        assert.equal(result[7], 128, 'Partial alpha channel must remain 128');
    });

    test('Histogram correctly bins 256 colors and calculates luminance', () => {
        const engine = CompositorEngine.createHeadless(3, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 3, 1);
        
        imgData.data.set([
            255, 0, 0, 255,   // Pure Red
            0, 255, 0, 255,   // Pure Green
            0, 0, 255, 255    // Pure Blue
        ]);
        ctx.putImageData(imgData, 0, 0);

        const hist = engine.computeHistogram();
        assert.ok(hist, 'Histogram should not be null');
        assert.equal(hist.red[255], 1, 'One pixel with red=255');
        assert.equal(hist.green[255], 1, 'One pixel with green=255');
        assert.equal(hist.blue[255], 1, 'One pixel with blue=255');

        // Luminance of pure red = 0.2126 * 255 ~ 54
        assert.ok(hist.lum[54] >= 1, 'Luminance bin for red should be ~54');
    });
});
