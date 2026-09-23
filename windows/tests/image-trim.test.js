const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Image Trim Pipeline (Mac ImageTrimTests Parity)', () => {
    test('calculateTrimRect transparent pixels with all 4 edges and partial edges', () => {
        const engine = CompositorEngine.createHeadless(20, 20);
        const layer = engine.addLayer('Content');
        layer.ctx.clearRect(0, 0, 20, 20);

        // 20x20 image:
        // Left transparent: 2 px (x < 2)
        // Right transparent: 3 px (x >= 17)
        // Top transparent: 4 px (y < 4)
        // Bottom transparent: 5 px (y >= 15)
        // Content: x: 2..<17 (width 15), y: 4..<15 (height 11)
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(2, 4, 15, 11);

        // All 4 edges
        const allRect = engine.calculateTrimRect({
            basedOn: 'transparentPixels',
            top: true,
            bottom: true,
            left: true,
            right: true
        });
        assert.ok(allRect);
        assert.equal(allRect.x, 2);
        assert.equal(allRect.y, 4);
        assert.equal(allRect.width, 15);
        assert.equal(allRect.height, 11);

        // Only top and bottom
        const tbRect = engine.calculateTrimRect({
            basedOn: 'transparentPixels',
            top: true,
            bottom: true,
            left: false,
            right: false
        });
        assert.ok(tbRect);
        assert.equal(tbRect.x, 0);
        assert.equal(tbRect.y, 4);
        assert.equal(tbRect.width, 20);
        assert.equal(tbRect.height, 11);

        // Only left and right
        const lrRect = engine.calculateTrimRect({
            basedOn: 'transparentPixels',
            top: false,
            bottom: false,
            left: true,
            right: true
        });
        assert.ok(lrRect);
        assert.equal(lrRect.x, 2);
        assert.equal(lrRect.y, 0);
        assert.equal(lrRect.width, 15);
        assert.equal(lrRect.height, 20);
    });

    test('calculateTrimRect color based trimming with top-left and bottom-right corner sampling', () => {
        const engine = CompositorEngine.createHeadless(30, 30);
        const layer = engine.addLayer('Canvas');

        // Fill background with white
        layer.ctx.fillStyle = '#ffffff';
        layer.ctx.fillRect(0, 0, 30, 30);

        // Center content with black
        layer.ctx.fillStyle = '#000000';
        layer.ctx.fillRect(5, 5, 20, 20);

        const trimRect = engine.calculateTrimRect({
            basedOn: 'topLeftPixelColor',
            top: true,
            bottom: true,
            left: true,
            right: true,
            tolerance: 0
        });

        assert.ok(trimRect);
        assert.equal(trimRect.x, 5);
        assert.equal(trimRect.y, 5);
        assert.equal(trimRect.width, 20);
        assert.equal(trimRect.height, 20);

        // Bottom right pixel color
        const brRect = engine.calculateTrimRect({
            basedOn: 'bottomRightPixelColor',
            top: true,
            bottom: true,
            left: true,
            right: true,
            tolerance: 0
        });

        assert.ok(brRect);
        assert.equal(brRect.x, 5);
        assert.equal(brRect.y, 5);
        assert.equal(brRect.width, 20);
        assert.equal(brRect.height, 20);
    });

    test('trimCanvas resizes document, offsets layer coordinates, and supports undo/redo', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.addLayer('Layer 1');
        layer.x = 0;
        layer.y = 0;
        layer.ctx.clearRect(0, 0, 100, 100);

        // Content situated at x=10..60, y=15..55 (width 50, height 40)
        layer.ctx.fillStyle = '#00ff00';
        layer.ctx.fillRect(10, 15, 50, 40);

        const initialHistoryLen = engine.history.length;
        const trimmed = engine.trimCanvas({
            basedOn: 'transparentPixels',
            top: true,
            bottom: true,
            left: true,
            right: true
        });

        assert.ok(trimmed);
        assert.equal(engine.width, 50);
        assert.equal(engine.height, 40);
        assert.equal(layer.x, -10);
        assert.equal(layer.y, -15);
        assert.equal(engine.history.length, initialHistoryLen + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Trim Canvas');

        // Test Undo
        engine.undo();
        assert.equal(engine.width, 100);
        assert.equal(engine.height, 100);
        assert.equal(engine.layers[1].x, 0);
        assert.equal(engine.layers[1].y, 0);

        // Test Redo
        engine.redo();
        assert.equal(engine.width, 50);
        assert.equal(engine.height, 40);
        assert.equal(engine.layers[1].x, -10);
        assert.equal(engine.layers[1].y, -15);
    });

    test('Solid single color image returns null / false for trim', () => {
        const engine = CompositorEngine.createHeadless(50, 50);
        const layer = engine.addLayer('Solid');
        layer.ctx.fillStyle = '#123456';
        layer.ctx.fillRect(0, 0, 50, 50);

        const rect = engine.calculateTrimRect({
            basedOn: 'topLeftPixelColor',
            top: true,
            bottom: true,
            left: true,
            right: true,
            tolerance: 0
        });

        assert.equal(rect, null);
        assert.equal(engine.trimCanvas({ basedOn: 'topLeftPixelColor' }), false);
    });
});
