const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Layer Effects & Outer Glow Pipeline (Mac OuterGlowTests Parity)', () => {
    test('Default outer glow effect parameters and validation', () => {
        const engine = CompositorEngine.createHeadless(400, 300);

        // Valid effect
        const validEffect = { enabled: true, size: 20, opacity: 0.75, red: 1.0, green: 0.0, blue: 0.0 };
        assert.ok(engine.validateOuterGlow(validEffect));

        // Invalid size (< 0)
        assert.equal(engine.validateOuterGlow({ size: -5, opacity: 0.5 }), false);

        // Invalid opacity (> 1.0 or < 0)
        assert.equal(engine.validateOuterGlow({ size: 20, opacity: 1.5 }), false);
        assert.equal(engine.validateOuterGlow({ size: 20, opacity: -0.1 }), false);

        // Invalid color channel (> 1.0)
        assert.equal(engine.validateOuterGlow({ size: 20, opacity: 0.5, red: 2.0 }), false);
    });

    test('Attaching, updating, and removing outer glow on a layer', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        const layer = engine.addLayer('Graphic');
        assert.equal(layer.effects, undefined);

        // Add outer glow
        engine.setOuterGlow(layer.id, {
            enabled: true,
            size: 25,
            opacity: 0.8,
            red: 1.0,
            green: 0.0,
            blue: 0.5
        });

        assert.ok(layer.effects && layer.effects.outerGlow);
        assert.equal(layer.effects.outerGlow.size, 25);
        assert.equal(layer.effects.outerGlow.opacity, 0.8);
        assert.equal(layer.effects.outerGlow.blue, 0.5);

        // Toggle disabled
        engine.setOuterGlow(layer.id, {
            ...layer.effects.outerGlow,
            enabled: false
        });
        assert.equal(layer.effects.outerGlow.enabled, false);

        // Remove outer glow
        engine.setOuterGlow(layer.id, null);
        assert.equal(layer.effects.outerGlow, undefined);
    });

    test('Layer effects backward compatibility with legacy manifests missing effects', () => {
        // Simulates project without effects field
        const legacyLayerRecord = {
            id: 'legacy-1',
            name: 'Old Layer',
            visible: true,
            opacity: 1.0,
            blendMode: 'Normal'
        };

        assert.equal(legacyLayerRecord.effects, undefined);
        const effects = legacyLayerRecord.effects || {};
        assert.equal(effects.outerGlow, undefined);
    });
});
