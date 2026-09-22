const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Adjustments & Filters Pipeline', () => {
    test('RGB to HSL and HSL to RGB roundtrip conversion maintains color precision', () => {
        const engine = CompositorEngine.createHeadless(10, 10);
        const testColors = [
            { r: 255, g: 0, b: 0 },     // Red
            { r: 0, g: 255, b: 0 },     // Green
            { r: 0, g: 0, b: 255 },     // Blue
            { r: 255, g: 255, b: 0 },   // Yellow
            { r: 0, g: 255, b: 255 },   // Cyan
            { r: 255, g: 0, b: 255 },   // Magenta
            { r: 128, g: 128, b: 128 }, // 50% Gray
            { r: 255, g: 255, b: 255 }, // White
            { r: 0, g: 0, b: 0 }        // Black
        ];

        for (const col of testColors) {
            const hsl = engine.rgbToHsl(col.r, col.g, col.b);
            const backRgb = engine.hslToRgb(hsl.h, hsl.s, hsl.l);
            assert.ok(Math.abs(backRgb.r - col.r) <= 1, `Red mismatch for (${col.r},${col.g},${col.b}): got ${backRgb.r}`);
            assert.ok(Math.abs(backRgb.g - col.g) <= 1, `Green mismatch for (${col.r},${col.g},${col.b}): got ${backRgb.g}`);
            assert.ok(Math.abs(backRgb.b - col.b) <= 1, `Blue mismatch for (${col.r},${col.g},${col.b}): got ${backRgb.b}`);
        }
    });

    test('Hue shift rotates colors around color wheel correctly', () => {
        const engine = CompositorEngine.createHeadless(1, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 1, 1);
        
        // Start with pure red (0 degrees)
        imgData.data.set([255, 0, 0, 255]);
        ctx.putImageData(imgData, 0, 0);

        // Shift hue by +120 deg -> Pure Green
        engine.applyHueSaturation(120, 0, 0);
        const greenRes = ctx.getImageData(0, 0, 1, 1).data;
        assert.ok(greenRes[1] > 240, 'Green channel should be dominant');
        assert.ok(greenRes[0] < 10, 'Red channel should be ~0');
        assert.ok(greenRes[2] < 10, 'Blue channel should be ~0');
    });

    test('Invert filter reverses RGB while preserving alpha', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        imgData.data.set([
            0, 100, 255, 255,
            50, 50, 50, 128
        ]);
        ctx.putImageData(imgData, 0, 0);

        engine.applyInvert();
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.equal(result[0], 255);
        assert.equal(result[1], 155);
        assert.equal(result[2], 0);
        assert.equal(result[3], 255);

        assert.equal(result[4], 205);
        assert.equal(result[5], 205);
        assert.equal(result[6], 205);
        assert.equal(result[7], 128, 'Alpha must be untouched by Invert');
    });

    test('Exposure filter applies EV stops and gamma correction accurately', () => {
        const engine = CompositorEngine.createHeadless(1, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 1, 1);
        
        imgData.data.set([64, 64, 64, 255]);
        ctx.putImageData(imgData, 0, 0);

        // +1 EV exposure stop doubles brightness (64 * 2 = 128)
        engine.applyExposure(1.0, 0, 1.0);
        const result = ctx.getImageData(0, 0, 1, 1).data;
        assert.ok(Math.abs(result[0] - 128) <= 2, `Expected ~128, got ${result[0]}`);
    });

    test('Curves adjustment modifies tone curve using 256-entry lookup table', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        imgData.data.set([
            100, 100, 100, 255,
            200, 200, 200, 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        const customCurve = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            customCurve[i] = 255 - i; // inversion curve
        }

        engine.applyCurves(customCurve, 'rgb');
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.equal(result[0], 155);
        assert.equal(result[4], 55);
    });

    test('Gradient Map applies perceptual luminance mapping according to formula', () => {
        const engine = CompositorEngine.createHeadless(2, 1);
        const layer = engine.getActiveLayer();
        const ctx = layer.ctx;
        const imgData = ctx.getImageData(0, 0, 2, 1);
        
        imgData.data.set([
            0, 0, 0, 255,     // Black -> level 0
            255, 255, 255, 255 // White -> level 255
        ]);
        ctx.putImageData(imgData, 0, 0);

        const gradientTable = new Array(256);
        for (let i = 0; i < 256; i++) {
            gradientTable[i] = { r: i, g: 0, b: 255 - i };
        }

        engine.applyGradientMap(gradientTable);
        const result = ctx.getImageData(0, 0, 2, 1).data;

        assert.equal(result[0], 0);
        assert.equal(result[2], 255);

        assert.equal(result[4], 255);
        assert.equal(result[6], 0);
    });
});
