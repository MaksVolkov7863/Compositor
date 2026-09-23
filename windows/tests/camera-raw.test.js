const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Camera Raw Filter Pipeline (Mac CameraRawTests Parity)', () => {
    test('Exposure adjustment accurately scales pixel intensity according to 2^stops', () => {
        const engine = CompositorEngine.createHeadless(20, 20);
        const layer = engine.addLayer('Photo');

        // Midtone gray pixel
        layer.ctx.fillStyle = 'rgb(64, 64, 64)';
        layer.ctx.fillRect(0, 0, 20, 20);

        // +1 EV should double intensity from ~64 to ~128
        engine.applyCameraRaw({ exposure: 1.0 });

        const data = layer.ctx.getImageData(10, 10, 1, 1).data;
        assert.ok(Math.abs(data[0] - 128) <= 2, `Expected ~128 after +1 stop exposure, got ${data[0]}`);
        assert.ok(Math.abs(data[1] - 128) <= 2);
        assert.ok(Math.abs(data[2] - 128) <= 2);
    });

    test('Temperature adjustment warms white balance by boosting red and lowering blue', () => {
        const engine = CompositorEngine.createHeadless(20, 20);
        const layer = engine.addLayer('Neutral');

        layer.ctx.fillStyle = 'rgb(120, 120, 120)';
        layer.ctx.fillRect(0, 0, 20, 20);

        // Warm temperature (+50)
        engine.applyCameraRaw({ temperature: 50 });

        const data = layer.ctx.getImageData(10, 10, 1, 1).data;
        assert.ok(data[0] > 120, `Red should increase with warm temperature, got ${data[0]}`);
        assert.ok(data[2] < 120, `Blue should decrease with warm temperature, got ${data[2]}`);
    });

    test('Camera Raw records single atomic undo step and respects selections', () => {
        const engine = CompositorEngine.createHeadless(40, 40);
        const layer = engine.addLayer('Layer');

        layer.ctx.fillStyle = 'rgb(100, 100, 100)';
        layer.ctx.fillRect(0, 0, 40, 40);
        engine.recordHistory('Fill Layer');

        // Select left half only [0, 0, 20, 40]
        engine.setRectSelection(0, 0, 20, 40);

        const initialHistoryCount = engine.history.length;
        engine.applyCameraRaw({ exposure: 1.0 });

        assert.equal(engine.history.length, initialHistoryCount + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Camera Raw Filter');

        // Inside selection should be brightened
        const inside = layer.ctx.getImageData(10, 20, 1, 1).data;
        assert.ok(inside[0] > 180, `Selected area should be brightened, got ${inside[0]}`);

        // Outside selection should remain unchanged (~100)
        const outside = layer.ctx.getImageData(30, 20, 1, 1).data;
        assert.equal(outside[0], 100, `Unselected area should remain 100, got ${outside[0]}`);

        // Undo restores initial values
        engine.undo();
        const restored = engine.getActiveLayer().ctx.getImageData(10, 20, 1, 1).data;
        assert.equal(restored[0], 100);
    });
});
