const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Canvas Size & Anchor Alignment Pipeline (Mac CanvasSizeTests Parity)', () => {
    test('Every anchor (0..8) translates layer origin correctly for both expansion and shrink', () => {
        // Mac CanvasSizeOptions uses 9 anchors:
        // 0: top-left, 1: top-center, 2: top-right
        // 3: mid-left,  4: center,     5: mid-right
        // 6: bot-left,  7: bot-center, 8: bot-right

        for (const delta of [20, -20]) {
            for (let anchor = 0; anchor <= 8; anchor++) {
                const engine = CompositorEngine.createHeadless(100, 100);
                const layer = engine.addLayer('Test Layer');
                layer.x = 20;
                layer.y = 20;
                layer.width = 40;
                layer.height = 40;

                const newW = 100 + delta;
                const newH = 100 + delta;

                engine.resizeCanvas(newW, newH, anchor);

                const ax = anchor % 3;
                const ay = Math.floor(anchor / 3);
                const expectedDx = ax === 0 ? 0 : (ax === 1 ? Math.round(delta / 2) : delta);
                const expectedDy = ay === 0 ? 0 : (ay === 1 ? Math.round(delta / 2) : delta);

                assert.equal(layer.x, 20 + expectedDx, `Anchor ${anchor} (delta ${delta}) X translation mismatch`);
                assert.equal(layer.y, 20 + expectedDy, `Anchor ${anchor} (delta ${delta}) Y translation mismatch`);
                assert.equal(engine.width, newW);
                assert.equal(engine.height, newH);
            }
        }
    });

    test('Canvas size modification records single undo action and can be undone cleanly', () => {
        const engine = CompositorEngine.createHeadless(200, 150);
        const layer = engine.addLayer('Layer 1');
        layer.x = 10;
        layer.y = 10;

        const initialHistoryCount = engine.history.length;
        engine.resizeCanvas(300, 250, 'center');

        assert.equal(engine.width, 300);
        assert.equal(engine.height, 250);
        assert.equal(engine.history.length, initialHistoryCount + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Canvas Size');

        // Undo restores previous dimensions
        engine.undo();
        assert.equal(engine.width, 200);
        assert.equal(engine.height, 150);
        assert.equal(engine.layers[1].x, 10);
        assert.equal(engine.layers[1].y, 10);
    });

    test('Relative canvas sizing calculates proper final dimensions', () => {
        const engine = CompositorEngine.createHeadless(1000, 500);
        // Relative +200 width, +100 height
        const targetW = engine.width + 200;
        const targetH = engine.height + 100;
        engine.resizeCanvas(targetW, targetH, 'center');

        assert.equal(engine.width, 1200);
        assert.equal(engine.height, 600);
    });
});
