const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Canvas Transforms & Geometric Operations Pipeline', () => {
    test('Flipping active layer toggles flipX and flipY flags', () => {
        const engine = CompositorEngine.createHeadless(500, 500);
        const layer = engine.getActiveLayer();

        assert.equal(layer.flipX, false);
        engine.flipLayer(true);
        assert.equal(layer.flipX, true);
        engine.flipLayer(true);
        assert.equal(layer.flipX, false);

        assert.equal(layer.flipY, false);
        engine.flipLayer(false);
        assert.equal(layer.flipY, true);
        engine.flipLayer(false);
        assert.equal(layer.flipY, false);
    });

    test('Canvas Size resizing with center anchor repositions layers symmetrically', () => {
        const engine = CompositorEngine.createHeadless(400, 400);
        const layer = engine.addLayer('Object');
        layer.x = 100;
        layer.y = 100;

        // Expanding canvas from 400x400 to 600x600 with center anchor
        // dx = (600 - 400) / 2 = 100, dy = 100
        engine.resizeCanvas(600, 600, 'center');

        assert.equal(engine.width, 600);
        assert.equal(engine.height, 600);
        assert.equal(layer.x, 200, 'Layer X should be offset by +100');
        assert.equal(layer.y, 200, 'Layer Y should be offset by +100');
    });

    test('Canvas Size resizing with top-left anchor keeps layer coordinates at (0, 0)', () => {
        const engine = CompositorEngine.createHeadless(300, 300);
        const layer = engine.addLayer('Object');
        layer.x = 50;
        layer.y = 50;

        engine.resizeCanvas(500, 500, 'top-left');
        assert.equal(engine.width, 500);
        assert.equal(engine.height, 500);
        assert.equal(layer.x, 50, 'Top-left anchor must not change layer position');
        assert.equal(layer.y, 50);
    });

    test('Image Size proportionally scales document and layer dimensions', () => {
        const engine = CompositorEngine.createHeadless(400, 200);
        const layer = engine.addLayer('Object');
        layer.x = 50;
        layer.y = 20;
        layer.width = 100;
        layer.height = 50;

        // Scale by 2x to 800x400
        engine.resizeImage(800, 400);

        assert.equal(engine.width, 800);
        assert.equal(engine.height, 400);
        assert.equal(layer.x, 100, 'Layer position X should double');
        assert.equal(layer.y, 40, 'Layer position Y should double');
        assert.equal(layer.width, 200, 'Layer width should double');
        assert.equal(layer.height, 100, 'Layer height should double');
    });

    test('Crop operation clamps bounds and shifts layer origins', () => {
        const engine = CompositorEngine.createHeadless(1000, 1000);
        const layer = engine.addLayer('Photo');
        layer.x = 200;
        layer.y = 200;

        // Crop rect: x=100, y=100, w=500, h=400
        engine.crop(100, 100, 500, 400);

        assert.equal(engine.width, 500);
        assert.equal(engine.height, 400);
        assert.equal(layer.x, 100, 'Layer X relative to cropped canvas (200 - 100 = 100)');
        assert.equal(layer.y, 100, 'Layer Y relative to cropped canvas (200 - 100 = 100)');
    });
});
