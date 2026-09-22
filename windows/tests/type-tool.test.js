const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Live Type Tool & Typography Pipeline (Mac TypeToolTests Parity)', () => {
    test('Create, edit, cancel and undo live text layer', () => {
        const engine = CompositorEngine.createHeadless(800, 600);
        const initialCount = engine.layers.length;
        const initialHistory = engine.history.length;

        // Add text layer
        const textLayer = engine.addTextLayer({
            text: 'Hello Compositor',
            x: 30,
            y: 40,
            fontSize: 48,
            color: '#ffffff'
        });

        assert.equal(engine.layers.length, initialCount + 1);
        assert.ok(textLayer.liveText);
        assert.equal(textLayer.liveText.content, 'Hello Compositor');
        assert.equal(textLayer.x, 30);
        assert.equal(textLayer.y, 40);
        assert.equal(engine.history.length, initialHistory + 1);

        // Edit text content
        engine.editTextLayer(textLayer.id, 'Updated Text', { fontSize: 36 });
        assert.equal(textLayer.liveText.content, 'Updated Text');
        assert.equal(textLayer.liveText.fontSize, 36);

        // Undo reverts edit to original content
        engine.undo();
        const active = engine.getActiveLayer();
        assert.equal(active.liveText.content, 'Hello Compositor');

        // Undo again removes the text layer
        engine.undo();
        assert.equal(engine.layers.length, initialCount);
    });

    test('Text rasterization produces colored glyphs on transparent background', () => {
        const engine = CompositorEngine.createHeadless(400, 200);
        const layer = engine.addTextLayer({
            text: 'TYPE',
            x: 0,
            y: 0,
            fontSize: 24,
            color: '#ff0000'
        });

        const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height).data;
        let inkPixels = 0;
        let clearPixels = 0;

        for (let i = 0; i < imgData.length; i += 4) {
            const alpha = imgData[i + 3];
            if (alpha === 0) {
                clearPixels++;
            } else if (alpha > 0) {
                inkPixels++;
                // Red glyphs
                assert.equal(imgData[i], 255, 'Glyph red component is 255');
                assert.equal(imgData[i + 1], 0);
                assert.equal(imgData[i + 2], 0);
            }
        }

        assert.ok(inkPixels > 0, 'Must have rendered glyph ink pixels');
        assert.ok(clearPixels > 0, 'Must have transparent background pixels');
    });

    test('Duplicate layer preserves liveText properties and editable typography', () => {
        const engine = CompositorEngine.createHeadless(400, 200);
        const layer = engine.addTextLayer({
            text: 'Duplicate Me',
            x: 50,
            y: 50,
            fontSize: 32,
            font: 'Segoe UI'
        });

        engine.duplicateLayer();
        const dup = engine.getActiveLayer();
        assert.notEqual(dup.id, layer.id);
        assert.ok(dup.liveText);
        assert.equal(dup.liveText.content, 'Duplicate Me');
        assert.equal(dup.liveText.fontSize, 32);
        assert.equal(dup.liveText.font, 'Segoe UI');
    });

    test('Clipping mask onto text layer maintains text layer integrity', () => {
        const engine = CompositorEngine.createHeadless(400, 200);
        const textLayer = engine.addTextLayer({ text: 'Mask Base' });
        const fillLayer = engine.addLayer('Fill Color');

        // Toggle clipping mask on upper fill layer
        engine.toggleClippingMask();
        assert.equal(fillLayer.maskSourceId, textLayer.id);
        assert.ok(textLayer.liveText, 'Base text layer retains liveText');
    });
});
