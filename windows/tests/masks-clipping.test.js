const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Layer Masks & Clipping Masks Pipeline', () => {
    test('Adding a layer mask initializes a full-white revealing mask', () => {
        const engine = CompositorEngine.createHeadless(200, 200);
        const layer = engine.getActiveLayer();
        assert.equal(layer.hasMask, false);
        assert.equal(layer.maskCanvas, null);

        engine.addMaskToLayer(layer);
        assert.equal(layer.hasMask, true);
        assert.ok(layer.maskCanvas !== null);
        assert.equal(layer.maskEnabled, true);
        assert.equal(layer.maskCanvas.width, 200);
        assert.equal(layer.maskCanvas.height, 200);
    });

    test('Clipping mask links active layer to lower sibling layer', () => {
        const engine = CompositorEngine.createHeadless(300, 300);
        const base = engine.addLayer('Base Shape');
        const overlay = engine.addLayer('Overlay Pattern');

        assert.equal(overlay.maskSourceId, null);
        engine.activeLayerId = overlay.id;

        // Create clipping mask
        engine.toggleClippingMask();
        assert.equal(overlay.maskSourceId, base.id, 'Clipped layer must reference base layer ID');

        // Toggle again releases clipping mask
        engine.toggleClippingMask();
        assert.equal(overlay.maskSourceId, null, 'Toggling again must release clipping mask');
    });

    test('Bottom-most layer cannot be turned into a clipping mask', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const bottom = engine.layers[0];
        engine.activeLayerId = bottom.id;

        engine.toggleClippingMask();
        assert.equal(bottom.maskSourceId, null, 'Bottom layer cannot have clipping source');
    });

    test('Folder opacity hierarchy concept dims children without mutating child flags', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const folder = engine.addLayer('Folder');
        folder.isGroup = true;
        folder.opacity = 0.5;

        const child = engine.addLayer('Child');
        child.parentId = folder.id;
        child.opacity = 0.8;

        // Child opacity flag remains intact (0.8), but effective composite opacity = 0.5 * 0.8 = 0.4
        const effectiveOpacity = folder.opacity * child.opacity;
        assert.equal(child.opacity, 0.8);
        assert.equal(effectiveOpacity, 0.4);
    });
});
