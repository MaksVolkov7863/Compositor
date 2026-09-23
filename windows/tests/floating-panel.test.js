const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const FloatingPanelController = require('../src/floating-panel.js');
const CompositorEngine = require('../src/engine.js');

describe('Floating Panel & Non-Modal Dialog Controller (Mac FloatingPanelTests Parity)', () => {
    test('Hue/Saturation and adjustment panels show, preview, commit and cancel cleanly', () => {
        const engine = CompositorEngine.createHeadless(40, 20);
        const layer = engine.getActiveLayer();

        // Fill with red
        layer.ctx.fillStyle = '#ff0000';
        layer.ctx.fillRect(0, 0, 40, 20);

        const initialIndex = engine.historyIndex;

        // Open floating panel for Hue/Saturation
        const panel = new FloatingPanelController('testHueSaturationPanel', { title: 'Hue/Saturation' });
        panel.onClose = () => {
            // Cancel preview: undo preview history step
            engine.undo();
        };
        panel.onCommit = () => {
            // Commit: keep change
        };

        panel.show({ hue: 40 });
        assert.equal(panel.isVisible, true);

        // Apply preview change
        engine.applyHueSaturation(40, 0, 0);
        assert.equal(engine.historyIndex, initialIndex + 1);

        // Cancel dialog rolls back preview step
        panel.close(false);
        assert.equal(panel.isVisible, false);
        assert.equal(panel.content, null);
        assert.equal(engine.historyIndex, initialIndex, 'Cancel must roll back preview via undo');

        // Commit dialog workflow keeps change
        panel.show({ hue: 60 });
        assert.equal(panel.isVisible, true);
        engine.applyHueSaturation(60, 0, 0);
        panel.close(true);
        assert.equal(panel.isVisible, false);
        assert.equal(engine.historyIndex, initialIndex + 1, 'Commit keeps adjustment in history');
    });

    test('Panel dragging clamps strictly within application viewport bounds', () => {
        const panel = new FloatingPanelController('inspectorPanel', {
            x: 50,
            y: 50,
            width: 300,
            height: 200
        });

        const viewportW = 1000;
        const viewportH = 800;

        // Try dragging past left and top edges
        panel.moveTo(-100, -50, viewportW, viewportH);
        assert.equal(panel.x, 0, 'X must clamp to 0 at left boundary');
        assert.equal(panel.y, 0, 'Y must clamp to 0 at top boundary');

        // Try dragging past right and bottom edges
        panel.moveTo(1200, 900, viewportW, viewportH);
        assert.equal(panel.x, 700, 'X must clamp to viewport width - panel width (1000 - 300 = 700)');
        assert.equal(panel.y, 600, 'Y must clamp to viewport height - panel height (800 - 200 = 600)');
    });
});
