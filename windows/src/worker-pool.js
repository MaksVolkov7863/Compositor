/**
 * WorkerPool - Asynchronous worker manager with Promise-based dispatch
 * and automatic fallback when Web Workers are unavailable.
 */

class WorkerPool {
    constructor(workerScript = 'workers/filter-worker.js') {
        this.workerScript = workerScript;
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
        this.isSupported = false;

        this._initWorker();
    }

    _initWorker() {
        if (typeof Worker !== 'undefined') {
            try {
                this.worker = new Worker(this.workerScript);
                this.worker.onmessage = (e) => {
                    const { id, success, buffer, error } = e.data;
                    const req = this.pendingRequests.get(id);
                    if (req) {
                        this.pendingRequests.delete(id);
                        if (success) {
                            req.resolve(buffer);
                        } else {
                            req.reject(new Error(error));
                        }
                    }
                };
                this.worker.onerror = (err) => {
                    for (const [, req] of this.pendingRequests) {
                        req.reject(err);
                    }
                    this.pendingRequests.clear();
                };
                this.isSupported = true;
            } catch {
                this.isSupported = false;
            }
        } else {
            this.isSupported = false;
        }
    }

    /**
     * Executes an operation asynchronously on the worker or via fallback
     * @param {string} type - Operation type ('gaussianBlur', 'featherMask', 'contentAwareFill')
     * @param {object} payload - Arguments
     * @param {Array<ArrayBuffer>} transferables - ArrayBuffers to transfer with zero copy
     * @returns {Promise<Uint8Array|Uint8ClampedArray>}
     */
    execute(type, payload, transferables = []) {
        if (!this.isSupported || !this.worker) {
            return Promise.resolve(this._executeFallback(type, payload));
        }

        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, payload }, transferables);
        });
    }

    _executeFallback(type, payload) {
        if (type === 'featherMask') {
            const { buffer, width, height, radius = 5 } = payload;
            const r = Math.max(1, Math.round(radius));
            const src = new Uint8Array(buffer);
            const temp = new Uint8Array(src.length);
            const dst = new Uint8Array(src.length);
            const w = width, h = height;

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

        if (type === 'gaussianBlur') {
            const { buffer, width, height, radius = 5 } = payload;
            const r = Math.max(1, Math.round(radius));
            const src = new Uint8ClampedArray(buffer);
            const temp = new Uint8ClampedArray(src.length);
            const dst = new Uint8ClampedArray(src.length);
            const w = width, h = height;

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
                    const o = (y * w + x) * 4;
                    temp[o] = Math.round(rAcc / count);
                    temp[o + 1] = Math.round(gAcc / count);
                    temp[o + 2] = Math.round(bAcc / count);
                    temp[o + 3] = Math.round(aAcc / count);
                }
            }

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
                    const o = (y * w + x) * 4;
                    dst[o] = Math.round(rAcc / count);
                    dst[o + 1] = Math.round(gAcc / count);
                    dst[o + 2] = Math.round(bAcc / count);
                    dst[o + 3] = Math.round(aAcc / count);
                }
            }
            return dst;
        }

        return payload.buffer;
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isSupported = false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerPool;
}
