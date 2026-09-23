const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const DownsampleCache = require('../src/downsample-cache.js');

describe('Downsample Cache & Image Pyramid (Mac DownsampleTests Parity)', () => {
    beforeEach(() => {
        DownsampleCache.shared.clear();
    });

    function createGrayImage(width, height, grayFn) {
        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const val = grayFn(x, y);
                const i = (y * width + x) * 4;
                pixels[i] = val;
                pixels[i + 1] = val;
                pixels[i + 2] = val;
                pixels[i + 3] = 255;
            }
        }
        return { id: `img_${width}x${height}`, width, height, pixels };
    }

    test('Halvings are reused and only used for large reductions (scale < 0.5)', () => {
        const source = createGrayImage(1024, 512, (x) => (x % 2 === 0 ? 0 : 255));

        // Half size and up draws the image itself
        assert.equal(DownsampleCache.shared.image(source, 0.6), source, 'Half size and up draws the source directly');
        assert.equal(DownsampleCache.shared.image(source, 0.5), source);

        // 0.3 uses the half (512x256)
        const half = DownsampleCache.shared.image(source, 0.3);
        assert.equal(half.width, 512);
        assert.equal(half.height, 256);

        // 0.125 uses the eighth (128x64)
        const eighth = DownsampleCache.shared.image(source, 0.125);
        assert.equal(eighth.width, 128);
        assert.equal(eighth.height, 64);

        // Re-requesting cached level returns identical object identity
        assert.equal(DownsampleCache.shared.image(source, 0.125), eighth, 'Cached levels are reused without recomputation');
    });

    test('A hard vertical edge stays sharp when shrunk eight times', () => {
        const source = createGrayImage(4096, 64, (x) => (x < 2048 ? 0 : 255));
        const eighth = DownsampleCache.shared.image(source, 0.125);

        assert.equal(eighth.width, 512);
        assert.equal(eighth.height, 8);

        // Sample middle row
        const row = [];
        for (let x = 0; x < 512; x++) {
            row.push(eighth.pixels[(4 * 512 + x) * 4]);
        }

        // Soft transition zone should be minimal (narrow step, no wide blur)
        const softCount = row.filter((v) => v > 40 && v < 215).length;
        assert.ok(softCount <= 4, `The edge must not smear across more than 4 pixels, got ${softCount}`);
        assert.ok(row[250] < 15, `Left of edge must be dark, got ${row[250]}`);
        assert.ok(row[262] > 240, `Right of edge must be bright, got ${row[262]}`);
    });

    test('Fine single-pixel stripes average to flat 50% gray without shimmer', () => {
        const source = createGrayImage(2048, 256, (x) => (x % 2 === 0 ? 0 : 255));
        const shrunk = DownsampleCache.shared.image(source, 0.125); // 256x32

        // Check inside values: should all converge to ~128
        let sum = 0;
        let count = 0;
        for (let x = 4; x < 252; x++) {
            const val = shrunk.pixels[(16 * 256 + x) * 4];
            sum += val;
            count++;
            assert.ok(Math.abs(val - 128) <= 2, `Pixel at x=${x} must be ~128, got ${val}`);
        }

        const mean = sum / count;
        assert.ok(Math.abs(mean - 128) < 1, `Mean intensity must be 128, got ${mean}`);
    });
});
