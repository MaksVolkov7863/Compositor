const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Smart Edit & Content-Aware Inpainting (Mac SmartEditTests Parity)', () => {
    test('Fill reconstructs background inside selection and undoes cleanly', () => {
        const engine = CompositorEngine.createHeadless(64, 48);
        const layer = engine.getActiveLayer();

        // 1. Fill base background with cyan (51, 153, 204)
        layer.ctx.fillStyle = 'rgb(51, 153, 204)';
        layer.ctx.fillRect(0, 0, 64, 48);

        // 2. Put red obstacle object at [20, 16, 12, 10]
        layer.ctx.fillStyle = 'rgb(255, 0, 0)';
        layer.ctx.fillRect(20, 16, 12, 10);
        engine.recordHistory('Draw Obstacle');

        const initialHistoryIndex = engine.historyIndex;

        // 3. Select obstacle area
        engine.setRectSelection(20, 16, 12, 10);

        // 4. Apply Content-Aware Fill
        engine.applyContentAwareFill();

        assert.equal(engine.historyIndex, initialHistoryIndex + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Content-Aware Fill');

        // Check center of former red obstacle: must now be reconstructed close to cyan background
        const centerPixel = layer.ctx.getImageData(26, 21, 1, 1).data;
        assert.ok(Math.abs(centerPixel[0] - 51) <= 15, `Red component should blend with background ~51, got ${centerPixel[0]}`);
        assert.ok(Math.abs(centerPixel[1] - 153) <= 15, `Green component should blend ~153, got ${centerPixel[1]}`);
        assert.ok(Math.abs(centerPixel[2] - 204) <= 15, `Blue component should blend ~204, got ${centerPixel[2]}`);

        // 5. Undo restores original red obstacle
        engine.undo();
        const restoredPixel = engine.getActiveLayer().ctx.getImageData(26, 21, 1, 1).data;
        assert.equal(restoredPixel[0], 255, 'Undo must restore original red obstacle pixel');
        assert.equal(restoredPixel[1], 0);
        assert.equal(restoredPixel[2], 0);
    });

    test('Calling fill without active selection leaves layer untouched', () => {
        const engine = CompositorEngine.createHeadless(30, 30);
        const layer = engine.getActiveLayer();
        layer.ctx.fillStyle = '#00ff00';
        layer.ctx.fillRect(0, 0, 30, 30);

        const initialHistoryIndex = engine.historyIndex;
        engine.selection = null;

        engine.applyContentAwareFill();

        assert.equal(engine.historyIndex, initialHistoryIndex, 'No history step added without selection');
        const pixel = layer.ctx.getImageData(15, 15, 1, 1).data;
        assert.equal(pixel[1], 255);
    });
});
