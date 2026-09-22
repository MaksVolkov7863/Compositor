const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Layer Management & Hierarchy Pipeline', () => {
    test('Default canvas creation starts with one background layer', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        assert.equal(engine.layers.length, 1);
        const bg = engine.layers[0];
        assert.equal(bg.name, 'Background');
        assert.equal(bg.width, 800);
        assert.equal(bg.height, 600);
        assert.equal(bg.opacity, 1.0);
        assert.equal(bg.visible, true);
        assert.equal(bg.blendMode, 'Normal');
        assert.equal(engine.activeLayerId, bg.id);
    });

    test('Adding layers inserts directly above the active layer', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        const l1 = engine.addLayer('Layer 1');
        const l2 = engine.addLayer('Layer 2');
        assert.equal(engine.layers.length, 3);
        assert.equal(engine.layers[1].name, 'Layer 1');
        assert.equal(engine.layers[2].name, 'Layer 2');

        // Select Layer 1 and add Layer 3 -> should be inserted between Layer 1 and Layer 2
        engine.activeLayerId = l1.id;
        const l3 = engine.addLayer('Layer 3');
        assert.equal(engine.layers.length, 4);
        assert.equal(engine.layers[1].id, l1.id);
        assert.equal(engine.layers[2].id, l3.id);
        assert.equal(engine.layers[3].id, l2.id);
    });

    test('Layer deletion auto-selects appropriate neighbor', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        const l1 = engine.addLayer('Layer 1');
        const l2 = engine.addLayer('Layer 2');
        
        // Active is l2 (top). Deleting it should select l1
        engine.deleteActiveLayer();
        assert.equal(engine.layers.length, 2);
        assert.equal(engine.activeLayerId, l1.id);

        // Deleting l1 selects background
        engine.deleteActiveLayer();
        assert.equal(engine.layers.length, 1);
        assert.equal(engine.activeLayerId, engine.layers[0].id);

        // Cannot delete last remaining layer
        engine.deleteActiveLayer();
        assert.equal(engine.layers.length, 1);
    });

    test('Duplicating layer clones properties and raster data', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        const l1 = engine.addLayer('Target');
        l1.opacity = 0.75;
        l1.blendMode = 'Multiply';
        l1.x = 25;
        l1.y = 50;
        l1.rotation = 45;
        l1.flipX = true;

        engine.duplicateLayer();
        assert.equal(engine.layers.length, 3);
        const dup = engine.getActiveLayer();
        assert.equal(dup.name, 'Target copy');
        assert.equal(dup.opacity, 0.75);
        assert.equal(dup.blendMode, 'Multiply');
        assert.equal(dup.x, 25);
        assert.equal(dup.y, 50);
        assert.equal(dup.rotation, 45);
        assert.equal(dup.flipX, true);
    });

    test('Layer reordering respects boundary conditions', () => {
        const engine = CompositorEngine.createHeadless(500, 500);
        const l1 = engine.addLayer('Layer 1');
        const l2 = engine.addLayer('Layer 2');

        // Initial: [Background, Layer 1, Layer 2]
        engine.moveLayer(2, 0); // Move Layer 2 to bottom
        assert.equal(engine.layers[0].id, l2.id);
        assert.equal(engine.layers[1].name, 'Background');
        assert.equal(engine.layers[2].id, l1.id);

        // Invalid indices do not corrupt array
        engine.moveLayer(-1, 5);
        assert.equal(engine.layers.length, 3);
    });

    test('Merging layers combines upper and lower layers', () => {
        const engine = CompositorEngine.createHeadless(200, 200);
        const l1 = engine.addLayer('Bottom');
        const l2 = engine.addLayer('Top');

        assert.equal(engine.layers.length, 3);
        engine.activeLayerId = l2.id;
        engine.mergeLayers();

        assert.equal(engine.layers.length, 2);
        assert.equal(engine.activeLayerId, l1.id);
    });

    test('Flatten image collapses all layers into a single background', () => {
        const engine = CompositorEngine.createHeadless(300, 300);
        engine.addLayer('Layer 1');
        engine.addLayer('Layer 2');
        engine.addLayer('Layer 3');
        assert.equal(engine.layers.length, 4);

        engine.flattenImage();
        assert.equal(engine.layers.length, 1);
        assert.equal(engine.layers[0].name, 'Background');
    });
});
