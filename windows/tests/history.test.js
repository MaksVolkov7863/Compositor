const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Undo / Redo History Stack Pipeline', () => {
    test('Action recording increments history state index', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const initialIdx = engine.historyIndex;

        engine.addLayer('Layer 1');
        assert.equal(engine.historyIndex, initialIdx + 1);
        assert.equal(engine.history[engine.historyIndex].name, 'Add Layer');

        engine.addLayer('Layer 2');
        assert.equal(engine.historyIndex, initialIdx + 2);
    });

    test('Undo and Redo step through states faithfully', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        engine.addLayer('Layer 1');
        engine.addLayer('Layer 2');
        assert.equal(engine.layers.length, 3);

        engine.undo();
        assert.equal(engine.layers.length, 2);
        assert.equal(engine.layers[1].name, 'Layer 1');

        engine.undo();
        assert.equal(engine.layers.length, 1);
        assert.equal(engine.layers[0].name, 'Background');

        // Cannot undo past initial state
        engine.undo();
        assert.equal(engine.layers.length, 1);

        // Redo forward
        engine.redo();
        assert.equal(engine.layers.length, 2);

        engine.redo();
        assert.equal(engine.layers.length, 3);
        assert.equal(engine.layers[2].name, 'Layer 2');
    });

    test('New action after undo discards future redo branch', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        engine.addLayer('A');
        engine.addLayer('B');
        engine.addLayer('C');
        assert.equal(engine.layers.length, 4);

        // Undo twice to state 'A'
        engine.undo();
        engine.undo();
        assert.equal(engine.layers.length, 2);

        // Perform new action 'D' -> should discard 'B' and 'C'
        engine.addLayer('D');
        assert.equal(engine.layers.length, 3);
        assert.equal(engine.layers[2].name, 'D');

        // Redo should do nothing now
        engine.redo();
        assert.equal(engine.layers.length, 3);
    });

    test('History size is bounded by maxHistory (40 states)', () => {
        const engine = CompositorEngine.createHeadless(10, 10);
        for (let i = 0; i < 50; i++) {
            engine.recordHistory(`Action ${i}`);
        }
        assert.ok(engine.history.length <= 40, `History length (${engine.history.length}) must not exceed 40`);
    });
});
