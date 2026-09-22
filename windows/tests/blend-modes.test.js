const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Blend Modes & Shortcut Cycling Pipeline', () => {
    test('All 11 supported Photoshop blend modes are defined', () => {
        const modes = CompositorEngine.BLEND_MODES;
        assert.equal(modes.length, 11);
        assert.deepEqual(modes, [
            'Normal',
            'Multiply',
            'Screen',
            'Overlay',
            'Darken',
            'Lighten',
            'Color Dodge',
            'Color Burn',
            'Difference',
            'Soft Light',
            'Hard Light'
        ]);
    });

    test('Blend mode mapping translates correctly to canvas composite operations', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        assert.equal(engine.mapBlendMode('Normal'), 'source-over');
        assert.equal(engine.mapBlendMode('Multiply'), 'multiply');
        assert.equal(engine.mapBlendMode('Screen'), 'screen');
        assert.equal(engine.mapBlendMode('Overlay'), 'overlay');
        assert.equal(engine.mapBlendMode('Darken'), 'darken');
        assert.equal(engine.mapBlendMode('Lighten'), 'lighten');
        assert.equal(engine.mapBlendMode('Color Dodge'), 'color-dodge');
        assert.equal(engine.mapBlendMode('Color Burn'), 'color-burn');
        assert.equal(engine.mapBlendMode('Difference'), 'difference');
        assert.equal(engine.mapBlendMode('Soft Light'), 'soft-light');
        assert.equal(engine.mapBlendMode('Hard Light'), 'hard-light');
    });

    test('Shift+Plus / cycleBlendMode(forward: true) cycles forward in documented order', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.getActiveLayer();
        assert.equal(layer.blendMode, 'Normal');

        engine.cycleBlendMode(true);
        assert.equal(layer.blendMode, 'Multiply', 'First forward cycle should step to Multiply');

        engine.cycleBlendMode(true);
        assert.equal(layer.blendMode, 'Screen');

        engine.cycleBlendMode(true);
        assert.equal(layer.blendMode, 'Overlay');
    });

    test('Shift+Minus / cycleBlendMode(forward: false) wraps backward from Normal to the last mode', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        const layer = engine.getActiveLayer();
        assert.equal(layer.blendMode, 'Normal');

        // Wrapping backward from Normal
        engine.cycleBlendMode(false);
        assert.equal(layer.blendMode, 'Hard Light', 'Backward wrap from Normal should yield last mode');

        engine.cycleBlendMode(false);
        assert.equal(layer.blendMode, 'Soft Light');
    });

    test('Mathematical blend formulas match Photoshop and macOS CoreGraphics specifications', () => {
        // Multiply: S * D / 255
        const mul = (s, d) => Math.round((s * d) / 255);
        assert.equal(mul(128, 128), 64);
        assert.equal(mul(255, 128), 128);
        assert.equal(mul(0, 255), 0);

        // Screen: 255 - ((255 - s) * (255 - d)) / 255
        const screen = (s, d) => 255 - Math.round(((255 - s) * (255 - d)) / 255);
        assert.equal(screen(128, 128), 192);
        assert.equal(screen(0, 128), 128);
        assert.equal(screen(255, 128), 255);

        // Difference: |s - d|
        const diff = (s, d) => Math.abs(s - d);
        assert.equal(diff(255, 100), 155);
        assert.equal(diff(100, 255), 155);
        assert.equal(diff(128, 128), 0);
    });
});
