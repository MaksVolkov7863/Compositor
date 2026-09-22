const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Selection Feathering & Clipboard Operations (Mac SelectionFeatherTests & SelectionClipboardTests Parity)', () => {
    test('Selection feathering softens hard binary mask into gradual alpha transitions', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        // Create 20x20 sharp box selection
        engine.setRectSelection(40, 40, 20, 20, false);
        assert.ok(engine.selection);

        const mask = new Uint8Array(100 * 100);
        for (let y = 40; y < 60; y++) {
            for (let x = 40; x < 60; x++) {
                mask[y * 100 + x] = 255;
            }
        }
        engine.selection.mask = mask;
        engine.selection.width = 100;
        engine.selection.height = 100;

        assert.equal(engine.selection.mask[40 * 100 + 40], 255);
        assert.equal(engine.selection.mask[39 * 100 + 40], 0);

        // Apply feather with radius 4
        engine.featherSelection(4);

        // Edge pixel should now have an intermediate feathered value
        const edgeVal = engine.selection.mask[40 * 100 + 40];
        assert.ok(edgeVal > 0 && edgeVal < 255, 'Feathered edge pixel has intermediate gradient value');
        assert.equal(engine.selection.feather, 4);
    });

    test('Copy selection extracts pixel bounds into engine clipboard', () => {
        const engine = CompositorEngine.createHeadless(200, 200);
        const layer = engine.addLayer('Source Layer');
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(0, 0, 200, 200);

        engine.setRectSelection(50, 50, 40, 30, false);
        const clip = engine.copySelection();

        assert.ok(clip);
        assert.equal(clip.width, 40);
        assert.equal(clip.height, 30);
        assert.equal(clip.x, 50);
        assert.equal(clip.y, 50);
        assert.deepEqual(engine.clipboard, clip);
    });

    test('Cut selection copies to clipboard and clears pixel area on active layer with undo support', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.addLayer('Source');
        layer.ctx.fillStyle = '#00ff00';
        layer.ctx.fillRect(0, 0, 100, 100);

        engine.setRectSelection(20, 20, 20, 20, false);
        const initialHistory = engine.history.length;

        const clip = engine.cutSelection();
        assert.ok(clip);

        // Pixel inside cut region is cleared (alpha 0)
        const cutPixel = layer.ctx.getImageData(25, 25, 1, 1).data;
        assert.equal(cutPixel[3], 0, 'Cut pixels cleared to transparent');

        // Pixel outside cut region remains green
        const outsidePixel = layer.ctx.getImageData(5, 5, 1, 1).data;
        assert.equal(outsidePixel[1], 255, 'Outside pixels remain untouched');

        assert.equal(engine.history.length, initialHistory + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Cut');
    });

    test('Paste selection creates a new layer from clipboard with proper coordinates and single undo step', () => {
        const engine = CompositorEngine.createHeadless(200, 200);
        const layer = engine.addLayer('Source');
        layer.ctx.fillStyle = '#0000ff';
        layer.ctx.fillRect(0, 0, 200, 200);

        engine.setRectSelection(30, 40, 50, 50, false);
        engine.copySelection();

        const beforeCount = engine.layers.length;
        const pastedLayer = engine.pasteSelection();

        assert.equal(engine.layers.length, beforeCount + 1);
        assert.equal(pastedLayer.name, 'Pasted Layer');
        assert.equal(pastedLayer.x, 30);
        assert.equal(pastedLayer.y, 40);
        assert.equal(pastedLayer.width, 50);
        assert.equal(pastedLayer.height, 50);

        // Undo removes pasted layer
        engine.undo();
        assert.equal(engine.layers.length, beforeCount);
    });
});
