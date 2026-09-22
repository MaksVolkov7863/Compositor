const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Clone Stamp & Spot Healing Pipeline (Mac CloneStampTests & SpotHealingTests Parity)', () => {
    test('Clone Stamp throws descriptive error when used without sample source point', () => {
        const engine = CompositorEngine.createHeadless(80, 40);
        engine.addLayer('Target Layer');
        engine.samplePoint = null;

        assert.throws(() => {
            engine.applyCloneStampStroke(60, 20);
        }, /source point/i);
    });

    test('Copies source pixels under brush, maintaining offset in aligned mode', () => {
        const engine = CompositorEngine.createHeadless(80, 40);
        const layer = engine.addLayer('Colors');

        // Left half red with a green square at (10..19, 15..24), right half blue
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(0, 0, 40, 40);
        layer.ctx.fillStyle = '#0000ff';
        layer.ctx.fillRect(40, 0, 40, 40);
        layer.ctx.fillStyle = '#00ff00';
        layer.ctx.fillRect(10, 15, 10, 10);

        engine.toolSettings.cloneStamp.size = 6;
        engine.cloneSettings.aligned = true;

        // Set source point at green square center (15, 20)
        engine.setCloneSource(15, 20);
        assert.deepEqual(engine.samplePoint, { x: 15, y: 20 });

        // Clone to (60, 20) in the blue area
        engine.applyCloneStampStroke(60, 20);

        const clonedPixel = layer.ctx.getImageData(60, 20, 1, 1).data;
        assert.equal(clonedPixel[0], 0, 'Green source copied: red should be 0');
        assert.equal(clonedPixel[1], 255, 'Green source copied: green should be 255');
        assert.equal(clonedPixel[2], 0, 'Green source copied: blue should be 0');

        // Untouched blue area
        const bluePixel = layer.ctx.getImageData(70, 5, 1, 1).data;
        assert.equal(bluePixel[2], 255, 'Untouched area remains blue');

        // Second stroke in aligned mode: preserves relative offset (target 66, 20 copies from 21, 20 which is red)
        engine.applyCloneStampStroke(66, 20);
        const secondCloned = layer.ctx.getImageData(66, 20, 1, 1).data;
        assert.equal(secondCloned[0], 255, 'Aligned next stroke copies red from (21, 20)');
    });

    test('Unaligned mode restarts each stroke from original source point', () => {
        const engine = CompositorEngine.createHeadless(80, 40);
        const layer = engine.addLayer('Colors');

        layer.ctx.fillStyle = '#00ff00';
        layer.ctx.fillRect(10, 15, 10, 10);
        layer.ctx.fillStyle = '#0000ff';
        layer.ctx.fillRect(40, 0, 40, 40);

        engine.toolSettings.cloneStamp.size = 6;
        engine.cloneSettings.aligned = false;
        engine.setCloneSource(15, 20); // Green square center

        // First stroke
        engine.applyCloneStampStroke(50, 10);
        let pixel = layer.ctx.getImageData(50, 10, 1, 1).data;
        assert.equal(pixel[1], 255, 'Green copied to (50, 10)');

        // Second stroke restarts at (15, 20)
        engine.applyCloneStampStroke(70, 30);
        pixel = layer.ctx.getImageData(70, 30, 1, 1).data;
        assert.equal(pixel[1], 255, 'Unaligned stroke copies original green source to (70, 30)');
    });

    test('Clone stamp maintains its own brush tip settings independently from regular brush', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        engine.toolSettings.brush.size = 30;
        engine.toolSettings.brush.hardness = 80;

        engine.toolSettings.cloneStamp.size = 45;
        engine.toolSettings.cloneStamp.hardness = 0;

        assert.equal(engine.toolSettings.cloneStamp.size, 45);
        assert.equal(engine.toolSettings.cloneStamp.hardness, 0);
        assert.equal(engine.toolSettings.brush.size, 30);
        assert.equal(engine.toolSettings.brush.hardness, 80);
    });

    test('Spot healing heals blemish under brush into surrounding texture, leaving outside untouched', () => {
        const engine = CompositorEngine.createHeadless(120, 80);
        const layer = engine.addLayer('Surface');

        // Fill with gray (128, 128, 128)
        layer.ctx.fillStyle = 'rgba(128, 128, 128, 1)';
        layer.ctx.fillRect(0, 0, 120, 80);

        // Put a red blemish at (55..65, 35..45)
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(55, 35, 10, 10);

        const beforeBlemish = layer.ctx.getImageData(60, 40, 1, 1).data;
        assert.equal(beforeBlemish[0], 255, 'Blemish starts red');

        const beforeOutside = layer.ctx.getImageData(10, 10, 1, 1).data;

        // Apply spot healing at (60, 40)
        engine.applySpotHealing(60, 40, 15);

        const afterBlemish = layer.ctx.getImageData(60, 40, 1, 1).data;
        // Blemish should be healed into surrounding gray (red significantly reduced, near gray)
        assert.ok(afterBlemish[0] < 200, 'Red component healed down towards surrounding surface');
        assert.ok(afterBlemish[1] > 50, 'Green component increased towards surrounding gray');

        // Outside brush radius remains untouched
        const afterOutside = layer.ctx.getImageData(10, 10, 1, 1).data;
        assert.deepEqual(afterOutside, beforeOutside, 'Outside brush radius remains strictly untouched');
    });
});
