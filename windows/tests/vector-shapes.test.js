const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Vector Shape Tools Pipeline (Mac ShapeToolTests Parity)', () => {
    test('Rectangle shape creates a new layer with foreground color and single undo step', () => {
        const engine = CompositorEngine.createHeadless(100, 80);
        engine.foregroundColor = '#ff0000';
        const initialCount = engine.history.length;

        const layer = engine.addShapeLayer('rectangle', { x: 10, y: 10, width: 30, height: 20 }, {
            fill: true,
            color: '#ff0000'
        });

        assert.equal(layer.name, 'Rectangle 1');
        assert.equal(layer.x, 10);
        assert.equal(layer.y, 10);
        assert.equal(layer.width, 30);
        assert.equal(layer.height, 20);
        assert.equal(engine.history.length, initialCount + 1);

        // Check pixel inside shape
        const pixelInside = layer.ctx.getImageData(15, 10, 1, 1).data;
        assert.equal(pixelInside[0], 255, 'Inside rectangle: red is 255');
        assert.equal(pixelInside[3], 255, 'Inside rectangle: alpha is 255');

        // Add second rectangle
        const layer2 = engine.addShapeLayer('rectangle', { x: 60, y: 10, width: 10, height: 10 });
        assert.equal(layer2.name, 'Rectangle 2');

        // Undo removes second rectangle
        engine.undo();
        assert.equal(engine.layers.length, 2);
    });

    test('Ellipse shape leaves corners transparent while filling central body', () => {
        const engine = CompositorEngine.createHeadless(100, 80);
        const layer = engine.addShapeLayer('ellipse', { x: 40, y: 30, width: 20, height: 20 }, {
            fill: true,
            color: '#ff0000'
        });

        assert.equal(layer.name, 'Ellipse 1');
        assert.equal(layer.width, 20);
        assert.equal(layer.height, 20);

        // Center of circle (10, 10 local)
        const center = layer.ctx.getImageData(10, 10, 1, 1).data;
        assert.equal(center[0], 255);
        assert.equal(center[3], 255);

        // Corner of bounding box (0, 0 local) outside the circle
        const corner = layer.ctx.getImageData(0, 0, 1, 1).data;
        assert.equal(corner[3], 0, 'Outside circle corner must have 0 alpha');
    });

    test('Rounded rectangle rounds corners and clamps oversized radius to pill shape', () => {
        const engine = CompositorEngine.createHeadless(100, 80);

        // 40 x 30 with radius 8
        const layer = engine.addShapeLayer('rounded', { x: 10, y: 10, width: 40, height: 30 }, {
            cornerRadius: 8,
            fill: true,
            color: '#ff0000'
        });
        assert.equal(layer.shapeCornerRadius, 8);

        // 40 x 20 with oversized radius 500 -> should clamp to pill (max radius = min(w, h)/2 = 10)
        const pillLayer = engine.addShapeLayer('rounded', { x: 55, y: 50, width: 40, height: 20 }, {
            cornerRadius: 500,
            fill: true,
            color: '#ff0000'
        });
        assert.equal(pillLayer.shapeCornerRadius, 10, 'Radius clamped to min(w, h)/2 for pill');

        // Corner at (0, 0 local) is cut away by rounding
        const pillCorner = pillLayer.ctx.getImageData(0, 0, 1, 1).data;
        assert.equal(pillCorner[3], 0, 'Pill corner outside arc is transparent');

        // Center of pill is filled
        const pillCenter = pillLayer.ctx.getImageData(20, 10, 1, 1).data;
        assert.equal(pillCenter[3], 255, 'Pill center is fully opaque');
    });
});
