const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Brush & Drawing Tool Pipeline (Mac BrushTests Parity)', () => {
    test('Bracket keys step brush diameter and respect clamping limits [1, 1000]', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        engine.toolSettings.brush.size = 20;

        // Step up (])
        const steppedUp = engine.stepBrushSize(5);
        assert.equal(steppedUp, 25);
        assert.equal(engine.toolSettings.brush.size, 25);

        // Step down ([)
        const steppedDown = engine.stepBrushSize(-10);
        assert.equal(steppedDown, 15);
        assert.equal(engine.toolSettings.brush.size, 15);

        // Lower clamp (minimum 1 px)
        engine.stepBrushSize(-500);
        assert.equal(engine.toolSettings.brush.size, 1);

        // Upper clamp (maximum 1000 px)
        engine.stepBrushSize(2000);
        assert.equal(engine.toolSettings.brush.size, 1000);
    });

    test('Shift+bracket keys step brush hardness in 25% intervals and clamp [0, 100]', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        engine.toolSettings.brush.hardness = 50;

        // Step hardness up (})
        const harder = engine.stepBrushHardness(25);
        assert.equal(harder, 75);
        assert.equal(engine.toolSettings.brush.hardness, 75);

        // Step hardness down ({)
        const softer1 = engine.stepBrushHardness(-25);
        assert.equal(softer1, 50);
        const softer2 = engine.stepBrushHardness(-25);
        assert.equal(softer2, 25);

        // Clamp at 0% minimum
        engine.stepBrushHardness(-100);
        assert.equal(engine.toolSettings.brush.hardness, 0);

        // Clamp at 100% maximum
        engine.stepBrushHardness(200);
        assert.equal(engine.toolSettings.brush.hardness, 100);
    });

    test('Hard brush draws opaque pixels matching foreground color', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.addLayer('Paint Layer');
        engine.foregroundColor = '#ff0000';
        engine.toolSettings.brush.size = 20;
        engine.toolSettings.brush.hardness = 100;
        engine.toolSettings.brush.opacity = 100;

        engine.drawBrushStroke(50, 50, false);
        const pixel = layer.ctx.getImageData(50, 50, 1, 1).data;
        assert.equal(pixel[0], 255, 'Red channel must be 255');
        assert.equal(pixel[1], 0, 'Green channel must be 0');
        assert.equal(pixel[2], 0, 'Blue channel must be 0');
        assert.equal(pixel[3], 255, 'Alpha channel must be full 255');
    });

    test('Continuous brush stroke records single history undo step', () => {
        const engine = CompositorEngine.createHeadless(200, 200);
        engine.addLayer('Stroke Layer');
        const initialHistoryCount = engine.history.length;

        engine.currentTool = 'brush';
        engine.pointerDown(20, 20);
        engine.pointerMove(50, 50);
        engine.pointerMove(100, 100);
        engine.pointerUp();

        assert.equal(engine.history.length, initialHistoryCount + 1, 'Only one history action recorded for complete stroke');
        assert.equal(engine.history[engine.historyIndex].name, 'BRUSH stroke');

        // Undo removes the stroke state
        engine.undo();
        assert.equal(engine.historyIndex, initialHistoryCount - 1);
    });

    test('Eraser tool clears pixels on active layer', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.addLayer('Erase Target');
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(0, 0, 100, 100);

        engine.toolSettings.eraser.size = 20;
        engine.toolSettings.eraser.hardness = 100;
        engine.drawBrushStroke(50, 50, true);

        const centerPixel = layer.ctx.getImageData(50, 50, 1, 1).data;
        // Erased center has zero or reduced alpha
        assert.ok(centerPixel[3] <= 5, 'Center pixel erased');
    });
});
