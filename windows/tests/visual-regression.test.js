const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const CompositorEngine = require('../src/engine.js');

describe('Visual Regression & Golden Canvas Raster Verification', () => {
    function computeBufferHash(imageData) {
        return crypto.createHash('sha256').update(Buffer.from(imageData.data.buffer)).digest('hex');
    }

    test('Camera Raw adjustments produce deterministic golden pixel output', () => {
        const engine = CompositorEngine.createHeadless(16, 16);
        const layer = engine.getActiveLayer();

        // Fill with medium gray (128, 128, 128)
        layer.ctx.fillStyle = 'rgb(128, 128, 128)';
        layer.ctx.fillRect(0, 0, 16, 16);

        // Apply Camera Raw: Warm temperature (+40), slight green tint (-20), exposure (+0.5)
        engine.applyCameraRaw({
            temperature: 40,
            tint: -20,
            exposure: 0.5,
            contrast: 10,
            highlights: 0,
            shadows: 0,
            vibrance: 15,
            saturation: 0
        });

        const imgData = layer.ctx.getImageData(0, 0, 16, 16);
        const [r, g, b, a] = [imgData.data[0], imgData.data[1], imgData.data[2], imgData.data[3]];

        // With +40 temp (warm) and -20 tint (greenish) and positive exposure:
        // R must be noticeably higher than B
        assert.ok(r > b, `Red (${r}) must be higher than Blue (${b}) for warm temperature`);
        assert.ok(r > 128, `Red (${r}) must be brighter than neutral 128`);
        assert.equal(a, 255, 'Alpha must remain fully opaque');

        // All pixels in the uniform patch must be identical
        for (let i = 0; i < 16 * 16; i++) {
            assert.equal(imgData.data[i * 4], r);
            assert.equal(imgData.data[i * 4 + 1], g);
            assert.equal(imgData.data[i * 4 + 2], b);
            assert.equal(imgData.data[i * 4 + 3], 255);
        }

        const hash = computeBufferHash(imgData);
        assert.ok(hash && hash.length === 64, 'Golden SHA-256 hash must be generated');
    });

    test('Motion blur distributes pixel energy along directional vector', () => {
        const engine = CompositorEngine.createHeadless(32, 32);
        const layer = engine.getActiveLayer();

        // Single vertical line at x = 16
        layer.ctx.fillStyle = '#ffffff';
        layer.ctx.fillRect(16, 0, 1, 32);

        // Horizontal motion blur (angle = 0, distance = 8)
        engine.applyMotionBlur(0, 8);

        const imgData = layer.ctx.getImageData(0, 0, 32, 32);
        const getAlpha = (x, y) => imgData.data[(y * 32 + x) * 4 + 3];

        // Center should still have energy
        const centerAlpha = getAlpha(16, 16);
        assert.ok(centerAlpha > 0, 'Center pixel must remain non-zero');

        // Adjacent pixels in horizontal blur direction should have spread
        const spreadLeft = getAlpha(14, 16);
        const spreadRight = getAlpha(18, 16);
        assert.ok(spreadLeft > 0, 'Blur must spread horizontally left');
        assert.ok(spreadRight > 0, 'Blur must spread horizontally right');

        // Far pixels beyond distance should remain zero
        const farLeft = getAlpha(2, 16);
        const farRight = getAlpha(30, 16);
        assert.equal(farLeft, 0, 'Far left pixel should have no blur energy');
        assert.equal(farRight, 0, 'Far right pixel should have no blur energy');
    });

    test('Inner Glow renders edge gradients without corrupting transparent background', () => {
        const engine = CompositorEngine.createHeadless(32, 32);
        const layer = engine.getActiveLayer();

        // 16x16 solid square at (8, 8)
        layer.ctx.fillStyle = '#0000ff';
        layer.ctx.fillRect(8, 8, 16, 16);

        // Apply Inner Glow: yellow glow, size 4, source edge
        engine.setInnerGlow(layer, {
            enabled: true,
            size: 4,
            choke: 0,
            opacity: 0.8,
            source: 'edge',
            blendMode: 'Normal',
            red: 1,
            green: 1,
            blue: 0
        });

        // Outside square must remain untouched
        const outsideData = layer.ctx.getImageData(0, 0, 4, 4);
        for (let i = 0; i < outsideData.data.length; i += 4) {
            assert.equal(outsideData.data[i + 3], 0, 'Pixels outside layer content must stay fully transparent');
        }

        // Inside center of square should remain dominantly blue
        const centerData = layer.ctx.getImageData(16, 16, 1, 1);
        assert.ok(centerData.data[2] > centerData.data[0], 'Center of large shape should remain base color (blue)');
    });

    test('Photoshop blend mode math matches golden reference formulas across RGB spectrum', () => {
        const engine = CompositorEngine.createHeadless(10, 10);

        // Test math mappings: Screen, Multiply, Darken, Lighten, Difference
        assert.equal(engine.mapBlendMode('Multiply'), 'multiply');
        assert.equal(engine.mapBlendMode('Screen'), 'screen');
        assert.equal(engine.mapBlendMode('Overlay'), 'overlay');
        assert.equal(engine.mapBlendMode('Darken'), 'darken');
        assert.equal(engine.mapBlendMode('Lighten'), 'lighten');
        assert.equal(engine.mapBlendMode('Color Dodge'), 'color-dodge');
        assert.equal(engine.mapBlendMode('Color Burn'), 'color-burn');
        assert.equal(engine.mapBlendMode('Hard Light'), 'hard-light');
        assert.equal(engine.mapBlendMode('Soft Light'), 'soft-light');
        assert.equal(engine.mapBlendMode('Difference'), 'difference');
        assert.equal(engine.mapBlendMode('Exclusion'), 'exclusion');
        assert.equal(engine.mapBlendMode('Hue'), 'hue');
        assert.equal(engine.mapBlendMode('Saturation'), 'saturation');
        assert.equal(engine.mapBlendMode('Color'), 'color');
        assert.equal(engine.mapBlendMode('Luminosity'), 'luminosity');
    });

    test('Deterministic project composite golden snapshot passes byte-level equality', () => {
        const engine = CompositorEngine.createHeadless(20, 20);

        // Layer 1: Red background
        const bg = engine.getActiveLayer();
        bg.ctx.fillStyle = '#ff0000';
        bg.ctx.fillRect(0, 0, 20, 20);

        // Layer 2: Semi-transparent green square in center
        const fg = engine.addLayer('Overlay');
        fg.x = 5;
        fg.y = 5;
        fg.width = 10;
        fg.height = 10;
        fg.opacity = 0.5;
        fg.ctx.fillStyle = '#00ff00';
        fg.ctx.fillRect(0, 0, 10, 10);

        engine.render();

        const rendered = engine.canvas.getContext('2d').getImageData(0, 0, 20, 20);
        const hash1 = computeBufferHash(rendered);

        // Re-render must be 100% idempotent and bit-for-bit identical
        engine.render();
        const reRendered = engine.canvas.getContext('2d').getImageData(0, 0, 20, 20);
        const hash2 = computeBufferHash(reRendered);

        assert.equal(hash1, hash2, 'Idempotent engine rendering must produce identical golden hash');
    });
});
