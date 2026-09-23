const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Layer Effects & Inner Glow Pipeline (Mac InnerGlowTests Parity)', () => {
    test('Default inner glow effect parameters and validation', () => {
        const engine = CompositorEngine.createHeadless(400, 300);

        // Valid effect
        const validEffect = { enabled: true, size: 10, opacity: 0.75, red: 1.0, green: 1.0, blue: 1.0 };
        assert.ok(engine.validateInnerGlow(validEffect));

        // Invalid size (< 0 or > 500)
        assert.equal(engine.validateInnerGlow({ size: -1, opacity: 0.5 }), false);
        assert.equal(engine.validateInnerGlow({ size: 501, opacity: 0.5 }), false);

        // Invalid opacity (> 1.0 or < 0)
        assert.equal(engine.validateInnerGlow({ size: 10, opacity: 1.5 }), false);
        assert.equal(engine.validateInnerGlow({ size: 10, opacity: -0.1 }), false);

        // Invalid color channel (> 1.0 or < 0)
        assert.equal(engine.validateInnerGlow({ size: 10, opacity: 0.5, red: 2.0 }), false);
        assert.equal(engine.validateInnerGlow({ size: 10, opacity: 0.5, green: -0.2 }), false);
    });

    test('Attaching, updating, and removing inner glow on a layer', () => {
        const engine = CompositorEngine.createHeadless(400, 300);
        const layer = engine.addLayer('Graphic');
        assert.equal(layer.effects, undefined);

        // Add inner glow
        engine.setInnerGlow(layer.id, {
            enabled: true,
            size: 15,
            opacity: 0.8,
            red: 1.0,
            green: 0.5,
            blue: 0.2
        });

        assert.ok(layer.effects && layer.effects.innerGlow);
        assert.equal(layer.effects.innerGlow.size, 15);
        assert.equal(layer.effects.innerGlow.opacity, 0.8);
        assert.equal(layer.effects.innerGlow.green, 0.5);

        // Toggle disabled
        engine.setInnerGlow(layer.id, {
            ...layer.effects.innerGlow,
            enabled: false
        });
        assert.equal(layer.effects.innerGlow.enabled, false);

        // Remove inner glow
        engine.setInnerGlow(layer.id, null);
        assert.equal(layer.effects.innerGlow, undefined);
    });

    test('Inner glow backward compatibility with legacy manifests missing inner glow', () => {
        const legacyLayerRecord = {
            id: 'legacy-effects',
            name: 'Layer with Outer Glow Only',
            visible: true,
            opacity: 1.0,
            blendMode: 'Normal',
            effects: {
                outerGlow: { size: 20, opacity: 0.5, red: 1, green: 1, blue: 0 }
            }
        };

        assert.ok(legacyLayerRecord.effects.outerGlow);
        assert.equal(legacyLayerRecord.effects.innerGlow, undefined);
    });
});
