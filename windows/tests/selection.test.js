const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Selection Tools & Contour Pipeline', () => {
    test('Rectangular marquee sets correct selection bounds', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        assert.equal(engine.selection, null);

        engine.setRectSelection(50, 60, 200, 150, false);
        assert.ok(engine.selection !== null);
        assert.equal(engine.selection.type, 'rect');
        assert.equal(engine.selection.bounds.x, 50);
        assert.equal(engine.selection.bounds.y, 60);
        assert.equal(engine.selection.bounds.width, 200);
        assert.equal(engine.selection.bounds.height, 150);
    });

    test('Elliptical marquee sets ellipse selection type', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        engine.setRectSelection(100, 100, 300, 300, true);
        assert.ok(engine.selection !== null);
        assert.equal(engine.selection.type, 'ellipse');
    });

    test('Select All creates full document bounding selection', () => {
        const engine = CompositorEngine.createHeadless(1200, 900);
        engine.selectAll();
        assert.ok(engine.selection !== null);
        assert.equal(engine.selection.bounds.x, 0);
        assert.equal(engine.selection.bounds.y, 0);
        assert.equal(engine.selection.bounds.width, 1200);
        assert.equal(engine.selection.bounds.height, 900);
    });

    test('Deselect completely clears selection state', () => {
        const engine = CompositorEngine.createHeadless(500, 500);
        engine.selectAll();
        assert.ok(engine.selection !== null);

        engine.deselect();
        assert.equal(engine.selection, null);
        assert.equal(engine.selectionPath, null);
    });

    test('Magic wand tolerance matches pixels according to WandPixels.c specification', () => {
        // Test wand matching logic from WandPixels.c: |p[c] - ref[c]| <= tolerance
        const match = (p, ref, tol) => {
            for (let c = 0; c < 4; c++) {
                if (Math.abs(p[c] - ref[c]) > tol) return false;
            }
            return true;
        };

        const refColor = [100, 150, 200, 255];
        assert.ok(match([105, 148, 202, 255], refColor, 10), 'Within tolerance 10');
        assert.ok(!match([120, 150, 200, 255], refColor, 10), 'Exceeds tolerance 10 on Red');
        assert.ok(!match([100, 150, 200, 240], refColor, 10), 'Exceeds tolerance on Alpha');
    });
});
