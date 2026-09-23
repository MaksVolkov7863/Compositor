/**
 * DownsampleCache - Powers-of-two image halving cache for sharp, high-performance zoomed-out rendering
 * 
 * Matches Swift DownsampleCache (Compositor/Rendering/DownsampleCache.swift)
 */

class DownsampleCache {
    constructor() {
        this.cache = new Map();
    }

    static get shared() {
        if (!DownsampleCache._instance) {
            DownsampleCache._instance = new DownsampleCache();
        }
        return DownsampleCache._instance;
    }

    clear() {
        this.cache.clear();
    }

    /**
     * Halves an RGBA Uint8ClampedArray (width x height) using box-averaging 2x2 filter
     */
    static halvePixels(pixels, width, height) {
        const halfW = Math.max(1, Math.floor(width / 2));
        const halfH = Math.max(1, Math.floor(height / 2));
        const out = new Uint8ClampedArray(halfW * halfH * 4);

        for (let y = 0; y < halfH; y++) {
            const srcY0 = y * 2;
            const srcY1 = Math.min(height - 1, srcY0 + 1);
            const row0 = srcY0 * width;
            const row1 = srcY1 * width;

            for (let x = 0; x < halfW; x++) {
                const srcX0 = x * 2;
                const srcX1 = Math.min(width - 1, srcX0 + 1);

                const i00 = (row0 + srcX0) * 4;
                const i01 = (row0 + srcX1) * 4;
                const i10 = (row1 + srcX0) * 4;
                const i11 = (row1 + srcX1) * 4;

                const outIdx = (y * halfW + x) * 4;
                out[outIdx] = Math.round((pixels[i00] + pixels[i01] + pixels[i10] + pixels[i11]) / 4);
                out[outIdx + 1] = Math.round((pixels[i00 + 1] + pixels[i01 + 1] + pixels[i10 + 1] + pixels[i11 + 1]) / 4);
                out[outIdx + 2] = Math.round((pixels[i00 + 2] + pixels[i01 + 2] + pixels[i10 + 2] + pixels[i11 + 2]) / 4);
                out[outIdx + 3] = Math.round((pixels[i00 + 3] + pixels[i01 + 3] + pixels[i10 + 3] + pixels[i11 + 3]) / 4);
            }
        }

        return { pixels: out, width: halfW, height: halfH };
    }

    static level(factor) {
        if (!Number.isFinite(factor) || factor <= 0 || factor >= 0.5) return 0;
        return Math.min(6, Math.floor(Math.log2(1 / factor)));
    }

    /**
     * Returns the cached downsampled version or the image itself if drawn at >= 0.5 scale
     * @param {{id?: string, width: number, height: number, pixels: Uint8ClampedArray}} source
     * @param {number} factor
     */
    image(source, factor) {
        const wanted = DownsampleCache.level(factor);
        if (wanted === 0 || (source.width <= 1 && source.height <= 1)) {
            return source;
        }

        const sourceKey = source.id || `${source.width}x${source.height}_${source.pixels.length}`;
        if (!this.cache.has(sourceKey)) {
            this.cache.set(sourceKey, []);
        }
        const levels = this.cache.get(sourceKey);

        while (levels.length < wanted) {
            const previous = levels.length > 0 ? levels[levels.length - 1] : source;
            if (previous.width <= 1 && previous.height <= 1) break;
            const next = DownsampleCache.halvePixels(previous.pixels, previous.width, previous.height);
            levels.push(next);
        }

        return levels[wanted - 1] || source;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownsampleCache;
}
