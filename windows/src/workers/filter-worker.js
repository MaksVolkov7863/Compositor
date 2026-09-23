/**
 * Compositor Filter & Processing Web Worker
 * 
 * Executes heavy pixel operations (Gaussian blur, mask feathering, content-aware inpainting)
 * asynchronously in a background thread to keep 60 FPS UI responsiveness.
 * Supports zero-copy memory transfers via Transferable ArrayBuffer.
 */

self.onmessage = function (e) {
    const { id, type, payload } = e.data;

    try {
        let resultBuffer;

        switch (type) {
            case 'gaussianBlur': {
                resultBuffer = processGaussianBlur(payload);
                break;
            }
            case 'featherMask': {
                resultBuffer = processFeatherMask(payload);
                break;
            }
            case 'contentAwareFill': {
                resultBuffer = processContentAwareFill(payload);
                break;
            }
            default:
                throw new Error(`Unknown worker operation: ${type}`);
        }

        self.postMessage(
            { id, success: true, buffer: resultBuffer },
            [resultBuffer.buffer] // Zero-copy Transferable ArrayBuffer
        );
    } catch (err) {
        self.postMessage({ id, success: false, error: err.message });
    }
};

/**
 * Separable Gaussian / Box Blur Filter
 */
function processGaussianBlur({ buffer, width, height, radius = 5 }) {
    const r = Math.max(1, Math.round(radius));
    const src = new Uint8ClampedArray(buffer);
    const temp = new Uint8ClampedArray(src.length);
    const dst = new Uint8ClampedArray(src.length);

    const w = width;
    const h = height;

    // Horizontal pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0, count = 0;
            for (let kx = -r; kx <= r; kx++) {
                const nx = x + kx;
                if (nx >= 0 && nx < w) {
                    const idx = (y * w + nx) * 4;
                    rAcc += src[idx];
                    gAcc += src[idx + 1];
                    bAcc += src[idx + 2];
                    aAcc += src[idx + 3];
                    count++;
                }
            }
            const outIdx = (y * w + x) * 4;
            temp[outIdx] = Math.round(rAcc / count);
            temp[outIdx + 1] = Math.round(gAcc / count);
            temp[outIdx + 2] = Math.round(bAcc / count);
            temp[outIdx + 3] = Math.round(aAcc / count);
        }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0, count = 0;
            for (let ky = -r; ky <= r; ky++) {
                const ny = y + ky;
                if (ny >= 0 && ny < h) {
                    const idx = (ny * w + x) * 4;
                    rAcc += temp[idx];
                    gAcc += temp[idx + 1];
                    bAcc += temp[idx + 2];
                    aAcc += temp[idx + 3];
                    count++;
                }
            }
            const outIdx = (y * w + x) * 4;
            dst[outIdx] = Math.round(rAcc / count);
            dst[outIdx + 1] = Math.round(gAcc / count);
            dst[outIdx + 2] = Math.round(bAcc / count);
            dst[outIdx + 3] = Math.round(aAcc / count);
        }
    }

    return dst;
}

/**
 * Mask Feathering (Separable 1D Gaussian kernel on 1-channel alpha mask)
 */
function processFeatherMask({ buffer, width, height, radius = 5 }) {
    const r = Math.max(1, Math.round(radius));
    const src = new Uint8Array(buffer);
    const temp = new Uint8Array(src.length);
    const dst = new Uint8Array(src.length);
    const w = width, h = height;

    // Horizontal
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0, count = 0;
            for (let kx = -r; kx <= r; kx++) {
                const nx = x + kx;
                if (nx >= 0 && nx < w) {
                    sum += src[y * w + nx];
                    count++;
                }
            }
            temp[y * w + x] = Math.round(sum / count);
        }
    }

    // Vertical
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let sum = 0, count = 0;
            for (let ky = -r; ky <= r; ky++) {
                const ny = y + ky;
                if (ny >= 0 && ny < h) {
                    sum += temp[ny * w + x];
                    count++;
                }
            }
            dst[y * w + x] = Math.round(sum / count);
        }
    }

    return dst;
}

/**
 * Content-Aware Inpainting Synthesis
 */
function processContentAwareFill({ buffer, mask, width, height }) {
    const pixels = new Uint8ClampedArray(buffer);
    const maskData = new Uint8Array(mask);
    const w = width, h = height;

    // Collect perimeter source samples around masked region
    const samples = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const mIdx = y * w + x;
            if (maskData[mIdx] === 0) {
                // Check if this pixel neighbors a masked pixel
                const hasMaskNeighbor = (
                    (x > 0 && maskData[mIdx - 1] > 0) ||
                    (x < w - 1 && maskData[mIdx + 1] > 0) ||
                    (y > 0 && maskData[mIdx - w] > 0) ||
                    (y < h - 1 && maskData[mIdx + w] > 0)
                );
                if (hasMaskNeighbor) {
                    const pIdx = mIdx * 4;
                    samples.push({
                        r: pixels[pIdx],
                        g: pixels[pIdx + 1],
                        b: pixels[pIdx + 2],
                        a: pixels[pIdx + 3]
                    });
                }
            }
        }
    }

    if (samples.length === 0) return pixels;

    // Fill masked pixels by synthesizing from sampled boundary texture
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const mIdx = y * w + x;
            if (maskData[mIdx] > 0) {
                // Pseudo-random deterministic sampling based on spatial hash
                const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
                const sample = samples[hash % samples.length];
                const pIdx = mIdx * 4;
                pixels[pIdx] = sample.r;
                pixels[pIdx + 1] = sample.g;
                pixels[pIdx + 2] = sample.b;
                pixels[pIdx + 3] = sample.a;
            }
        }
    }

    return pixels;
}
