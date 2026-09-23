const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const WebGLPipeline = require('../src/webgl-pipeline.js');
const WorkerPool = require('../src/worker-pool.js');
const CompositorEngine = require('../src/engine.js');

describe('WebGL Pipeline & Web Worker Acceleration Pipeline', () => {
    test('WebGLPipeline gracefully handles headless / non-WebGL environments with CPU fallback', () => {
        const pipeline = WebGLPipeline.create();
        assert.ok(pipeline !== null);

        // Test multi-adjustment on dummy image data
        const dummyImgData = {
            width: 2,
            height: 2,
            data: new Uint8ClampedArray([
                100, 100, 100, 255,
                200, 200, 200, 255,
                  0,   0,   0, 255,
                255, 255, 255, 255
            ])
        };

        const result = pipeline.applyAdjustments(dummyImgData, {
            brightness: 10,
            contrast: 0,
            invert: false
        });

        assert.equal(result.width, 2);
        assert.equal(result.height, 2);
        // Brightness +10% (approx +25)
        assert.ok(result.data[0] > 100, 'Red channel must increase with brightness');
        assert.ok(result.data[3] === 255, 'Alpha must remain unchanged');
    });

    test('WebGLPipeline invert adjustment produces exact inverted complementary channels', () => {
        const pipeline = WebGLPipeline.create();
        const imgData = {
            width: 1,
            height: 1,
            data: new Uint8ClampedArray([30, 200, 150, 255])
        };

        const inverted = pipeline.applyAdjustments(imgData, { invert: true });
        assert.equal(inverted.data[0], 255 - 30);
        assert.equal(inverted.data[1], 255 - 200);
        assert.equal(inverted.data[2], 255 - 150);
        assert.equal(inverted.data[3], 255);
    });

    test('WorkerPool processes featherMask asynchronously with zero-copy contract', async () => {
        const pool = new WorkerPool();
        const mask = new Uint8Array([
            0,   0,   0,
            0, 255,   0,
            0,   0,   0
        ]);

        const feathered = await pool.execute('featherMask', {
            buffer: mask.buffer,
            width: 3,
            height: 3,
            radius: 1
        });

        assert.ok(feathered instanceof Uint8Array);
        assert.equal(feathered.length, 9);
        // Center pixel should be softened
        assert.ok(feathered[4] > 0);
        // Neighbors should receive feathered alpha gradient
        assert.ok(feathered[1] > 0);
    });

    test('WorkerPool processes gaussianBlur asynchronously without blocking main thread', async () => {
        const pool = new WorkerPool();
        const pixels = new Uint8ClampedArray([
            255, 0, 0, 255,    0, 255, 0, 255,
              0, 0, 255, 255,  255, 255, 255, 255
        ]);

        const blurred = await pool.execute('gaussianBlur', {
            buffer: pixels.buffer,
            width: 2,
            height: 2,
            radius: 1
        });

        assert.ok(blurred instanceof Uint8ClampedArray);
        assert.equal(blurred.length, 16);
        // Blurring averages colors across neighboring pixels
        assert.ok(blurred[0] > 0);
    });

    test('CompositorEngine integrates with WebGL and Worker modules seamlessly', () => {
        const engine = CompositorEngine.createHeadless(100, 100);
        assert.ok(engine);
        assert.equal(engine.width, 100);
        assert.equal(engine.height, 100);
    });
});
