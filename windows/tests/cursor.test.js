const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CursorManager = require('../src/cursor-manager.js');

describe('Tool Cursor & Canvas Boundary Pipeline (Mac CursorTests Parity)', () => {
    const tools = ['move', 'marquee', 'lasso', 'wand', 'brush', 'eraser', 'healing', 'type', 'hand', 'zoom'];

    test('Leaving the canvas restores the arrow (default) with every tool', () => {
        const manager = new CursorManager();

        for (const tool of tools) {
            manager.mouseEnterCanvas();
            manager.setTool(tool);

            // Inside canvas: should have specialized tool cursor
            assert.notEqual(manager.currentCursor, '', `Tool ${tool} must have a valid cursor`);

            // Mouse leaves canvas (e.g. over layers list or inspector)
            manager.mouseLeaveCanvas();
            assert.equal(
                manager.currentCursor,
                'default',
                `Tool ${tool}: cursor must restore to default arrow upon leaving canvas`
            );
        }
    });

    test('A drag released outside the canvas restores the default arrow', () => {
        const manager = new CursorManager();
        manager.setTool('hand');
        manager.mouseEnterCanvas();

        // Mouse down inside canvas (starts dragging / panning)
        manager.mouseDown();
        assert.equal(manager.currentCursor, 'grabbing', 'MouseDown on hand tool sets grabbing');

        // Drag leaves canvas and is released outside
        manager.mouseUp(true);
        assert.equal(manager.currentCursor, 'default', 'MouseUp outside canvas restores default arrow');
    });

    test('Brush and eraser cursors scale with brush diameter', () => {
        const manager = new CursorManager();
        manager.setTool('brush');
        manager.mouseEnterCanvas();

        manager.setBrushSize(35);
        assert.equal(manager.currentCursor, 'circle-35');

        manager.setBrushSize(80);
        assert.equal(manager.currentCursor, 'circle-80');

        manager.setTool('eraser');
        assert.equal(manager.currentCursor, 'circle-80');
    });

    test('Selection and eyedropper tools show crosshair cursor', () => {
        const manager = new CursorManager();
        manager.mouseEnterCanvas();

        for (const tool of ['marquee', 'lasso', 'wand', 'eyedropper']) {
            manager.setTool(tool);
            assert.equal(manager.currentCursor, 'crosshair', `Tool ${tool} must show crosshair`);
        }
    });
});
