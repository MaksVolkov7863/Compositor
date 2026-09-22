const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Guides, Snapping & Rulers Pipeline (Mac GuideTests Parity)', () => {
    test('Adding guides, undoing, and clear guides behavior', () => {
        const engine = CompositorEngine.createHeadless(200, 100);
        assert.equal(engine.guides.vertical.length, 0);
        assert.equal(engine.guides.horizontal.length, 0);

        const v = engine.addGuide('vertical', 40);
        const h = engine.addGuide('horizontal', 25);

        assert.equal(engine.guides.vertical.length, 1);
        assert.equal(engine.guides.horizontal.length, 1);
        assert.equal(engine.guides.vertical[0], 40);
        assert.equal(engine.guides.horizontal[0], 25);

        engine.clearGuides();
        assert.equal(engine.guides.vertical.length, 0);
        assert.equal(engine.guides.horizontal.length, 0);
    });

    test('Locked guides prevents adding or removing guides, but clearGuides still works', () => {
        const engine = CompositorEngine.createHeadless(200, 100);
        engine.locksGuides = true;

        // Trying to add guide while locked does nothing
        const guide = engine.addGuide('vertical', 10);
        assert.equal(guide, null);
        assert.equal(engine.guides.vertical.length, 0);

        // Unlock, add guide, relock
        engine.locksGuides = false;
        engine.addGuide('vertical', 10);
        assert.equal(engine.guides.vertical.length, 1);

        engine.locksGuides = true;
        // Removing single guide is prevented
        const removed = engine.removeGuide(10, 'vertical');
        assert.equal(removed, false);
        assert.equal(engine.guides.vertical.length, 1);

        // Clear guides still functions when locked (matching GuideTests.swift line 48)
        engine.clearGuides();
        assert.equal(engine.guides.vertical.length, 0);
    });

    test('Flipping canvas mirrors vertical and horizontal guides', () => {
        const engine = CompositorEngine.createHeadless(100, 40);
        engine.addGuide('vertical', 20);
        engine.addGuide('horizontal', 10);

        // Horizontal flip: x guide at 20 becomes 100 - 20 = 80
        engine.flipCanvas(true);
        assert.equal(engine.guides.vertical[0], 80);
        assert.equal(engine.guides.horizontal[0], 10);

        // Vertical flip: y guide at 10 becomes 40 - 10 = 30
        engine.flipCanvas(false);
        assert.equal(engine.guides.vertical[0], 80);
        assert.equal(engine.guides.horizontal[0], 30);
    });

    test('Canvas resize offsets guides according to anchor and image resize scales guides', () => {
        const engine = CompositorEngine.createHeadless(100, 50);
        engine.addGuide('vertical', 20);
        engine.addGuide('horizontal', 10);

        // Resize canvas to 140x80 with bottom-right anchor (anchor 8: dx = 40, dy = 30)
        engine.resizeCanvas(140, 80, 8);
        assert.equal(engine.guides.vertical[0], 60, 'Vertical guide offset by dx (+40)');
        assert.equal(engine.guides.horizontal[0], 40, 'Horizontal guide offset by dy (+30)');

        // Resize image scaled 2x (from 140x80 to 280x160)
        engine.resizeImage(280, 160);
        assert.equal(engine.guides.vertical[0], 120, 'Vertical guide scaled 2x');
        assert.equal(engine.guides.horizontal[0], 80, 'Horizontal guide scaled 2x');
    });

    test('Snapping targets follow view settings and guide visibility', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        const layer = engine.addLayer('Target Layer');
        layer.x = 150;
        layer.y = 120;
        layer.width = 100;
        layer.height = 60;

        let snap = engine.cropSnapTargets();
        // Document bounds: [0, 400], layer bounds: [150, 250]
        assert.ok(snap.xs.includes(0));
        assert.ok(snap.xs.includes(400));
        assert.ok(snap.xs.includes(150));
        assert.ok(snap.xs.includes(250));

        // When snap is disabled, targets list is empty
        engine.snapEnabled = false;
        assert.equal(engine.cropSnapTargets().xs.length, 0);

        // Enable snap, toggle guides
        engine.snapEnabled = true;
        engine.snapToDocumentBounds = false;
        engine.snapToLayers = false;
        engine.snapToGuides = true;
        engine.showGuides = true;
        engine.addGuide('vertical', 33);

        snap = engine.cropSnapTargets();
        assert.deepEqual(snap.xs, [33]);

        // Hiding guides disables guide snapping
        engine.showGuides = false;
        snap = engine.cropSnapTargets();
        assert.equal(snap.xs.length, 0, 'Hidden guides do not snap');
    });
});
