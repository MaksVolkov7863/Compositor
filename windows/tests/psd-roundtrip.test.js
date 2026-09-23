const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { PSDReader, PSDFixture } = require('../src/psd-reader.js');
const CompositorEngine = require('../src/engine.js');

describe('Photoshop PSD Binary Round-Trip & Parser Pipeline (Mac PSDRoundTripTests Parity)', () => {
    test('roundTripLayersOrderVisibilityOpacityAndBlend matches PSDRoundTripTests', () => {
        // Construct two test layers: Red (opacity 0.5, multiply) and Blue (hidden, normal)
        const mockPSD = {
            width: 4,
            height: 4,
            resolution: 144,
            layers: [
                {
                    name: 'Red',
                    bounds: { x: 0, y: 0, width: 2, height: 2 },
                    blendKey: 'mul ',
                    opacity: 0.5,
                    isVisible: true
                },
                {
                    name: 'Blue',
                    bounds: { x: 2, y: 0, width: 2, height: 2 },
                    blendKey: 'norm',
                    opacity: 1.0,
                    isVisible: false
                }
            ]
        };

        const binary = PSDFixture.data(mockPSD);
        assert.equal(binary.subarray(0, 4).toString('utf8'), '8BPS', 'Signature must start with 8BPS');

        const document = PSDReader.read(binary);
        assert.equal(document.width, 4);
        assert.equal(document.height, 4);
        assert.equal(document.resolution, 144);
        assert.deepEqual(document.layers.map(l => l.name), ['Red', 'Blue']);

        // Layer 0: Red
        assert.equal(document.layers[0].isVisible, true);
        assert.ok(Math.abs(document.layers[0].opacity - 0.5) < 0.01, 'Opacity must be ~0.5');
        assert.equal(document.layers[0].blendKey, 'mul ');
        assert.equal(document.layers[0].blendMode, 'Multiply');
        assert.equal(document.layers[0].bounds.width, 2);
        assert.equal(document.layers[0].bounds.height, 2);

        // Layer 1: Blue
        assert.equal(document.layers[1].isVisible, false, 'Blue layer must be hidden');
        assert.equal(document.layers[1].blendKey, 'norm');
        assert.equal(document.layers[1].blendMode, 'Normal');

        // Convert to Compositor layers and import into Engine
        const compLayers = PSDReader.toCompositorLayers(document);
        assert.equal(compLayers.length, 2);
        assert.equal(compLayers[0].name, 'Red');
        assert.equal(compLayers[0].blendMode, 'Multiply');
        assert.equal(compLayers[1].visible, false);

        const engine = CompositorEngine.createHeadless(4, 4);
        for (const cl of compLayers) {
            const l = engine.addLayer(cl.name);
            l.x = cl.x;
            l.y = cl.y;
            l.width = cl.width;
            l.height = cl.height;
            l.opacity = cl.opacity;
            l.visible = cl.visible;
            l.blendMode = cl.blendMode;
        }

        assert.equal(engine.layers.length, 3); // Background + 2 PSD layers
        assert.equal(engine.layers[1].blendMode, 'Multiply');
        assert.equal(engine.layers[2].visible, false);
    });

    test('Corrupt PSD signatures and truncated headers are rejected', () => {
        // Bad signature
        const badSig = Buffer.from('NOTAPSD_HEADER_TOO_LONG');
        assert.throws(
            () => PSDReader.read(badSig),
            /Invalid PSD signature/
        );

        // Too small
        const tiny = Buffer.from('8B');
        assert.throws(
            () => PSDReader.read(tiny),
            /File too small/
        );
    });

    test('All standard Photoshop 4-character blend mode keys map to CSS blend modes', () => {
        const keys = {
            'norm': 'Normal',
            'mul ': 'Multiply',
            'scrn': 'Screen',
            'over': 'Overlay',
            'dark': 'Darken',
            'lite': 'Lighten',
            'diff': 'Difference',
            'smud': 'Exclusion',
            'sLit': 'Soft Light',
            'hLit': 'Hard Light',
            'colr': 'Color',
            'lum ': 'Luminosity',
            'hue ': 'Hue',
            'sat ': 'Saturation'
        };

        for (const [key, expected] of Object.entries(keys)) {
            assert.equal(PSDReader.BLEND_KEYS[key], expected, `Key ${key} must map to ${expected}`);
        }
    });
});
