/**
 * DistortWarp - Free Transform, Perspective and Quadrilateral Distortion Geometry
 * 
 * Matches Swift DistortWarp (Compositor/Document/Distort.swift)
 */

class DistortWarp {
    /**
     * Signed triangle area (twice the area) for 3 2D points
     */
    static area(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    /**
     * Four finite corners with non-degenerate area in both triangular halves
     * @param {Array<{x: number, y: number}>} corners - [top-left, top-right, bottom-right, bottom-left]
     * @returns {boolean}
     */
    static isUsable(corners) {
        if (!Array.isArray(corners) || corners.length !== 4) return false;
        for (const p of corners) {
            if (typeof p.x !== 'number' || typeof p.y !== 'number') return false;
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
            if (Math.abs(p.x) > 1000000 || Math.abs(p.y) > 1000000) return false;
        }
        // Both halves need area, or one has nothing to draw
        const half1 = Math.abs(this.area(corners[0], corners[1], corners[2]));
        const half2 = Math.abs(this.area(corners[0], corners[2], corners[3]));
        return half1 > 0.01 && half2 > 0.01;
    }

    /**
     * A shape a perspective warp can take: convex quad wound consistently either clockwise or CCW
     * @param {Array<{x: number, y: number}>} corners
     * @returns {boolean}
     */
    static isConvex(corners) {
        if (!this.isUsable(corners)) return false;
        let sign = 0;
        for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            const c = corners[(i + 2) % 4];
            const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            if (Math.abs(cross) <= 0.01) return false;
            if (sign === 0) {
                sign = cross < 0 ? -1 : 1;
            } else if ((cross < 0) !== (sign < 0)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns the 4 corners of a transformed layer [TL, TR, BR, BL]
     * @param {{x: number, y: number, width: number, height: number, rotation?: number, flipX?: boolean, flipY?: boolean}} transform
     */
    static corners(transform) {
        const x = transform.x || 0;
        const y = transform.y || 0;
        const w = transform.width || 0;
        const h = transform.height || 0;
        const rot = ((transform.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);

        const cx = x + w / 2;
        const cy = y + h / 2;

        function transformPoint(px, py) {
            // Apply flip relative to center
            let dx = px - cx;
            let dy = py - cy;
            if (transform.flipX) dx = -dx;
            if (transform.flipY) dy = -dy;

            // Apply rotation
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;

            return { x: cx + rx, y: cy + ry };
        }

        return [
            transformPoint(x, y),         // TL
            transformPoint(x + w, y),     // TR
            transformPoint(x + w, y + h), // BR
            transformPoint(x, y + h)      // BL
        ];
    }

    /**
     * Perspective mapping (homography / projective transform) of unit square [0..1] x [0..1] onto 4 corners c
     * @param {Array<{x: number, y: number}>} c - Target quad corners [TL, TR, BR, BL]
     * @returns {function({x: number, y: number}): {x: number, y: number}}
     */
    static homography(c) {
        const sx = c[0].x - c[1].x + c[2].x - c[3].x;
        const sy = c[0].y - c[1].y + c[2].y - c[3].y;
        let g = 0;
        let h = 0;

        if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
            const dx1 = c[1].x - c[2].x;
            const dx2 = c[3].x - c[2].x;
            const dy1 = c[1].y - c[2].y;
            const dy2 = c[3].y - c[2].y;
            const den = dx1 * dy2 - dx2 * dy1;
            if (Math.abs(den) > 1e-12) {
                g = (sx * dy2 - dx2 * sy) / den;
                h = (dx1 * sy - sx * dy1) / den;
            }
        }

        const a = c[1].x - c[0].x + g * c[1].x;
        const b = c[3].x - c[0].x + h * c[3].x;
        const x0 = c[0].x;

        const d = c[1].y - c[0].y + g * c[1].y;
        const e = c[3].y - c[0].y + h * c[3].y;
        const y0 = c[0].y;

        return function mapPoint(p) {
            const w = g * p.x + h * p.y + 1;
            return {
                x: (a * p.x + b * p.y + x0) / w,
                y: (d * p.x + e * p.y + y0) / w
            };
        };
    }

    /**
     * Calculates 2D affine transform matrix taking 3 source points to 3 destination points
     */
    static affine(source, target) {
        const [s0, s1, s2] = source;
        const [t0, t1, t2] = target;

        const u = { x: s1.x - s0.x, y: s1.y - s0.y };
        const v = { x: s2.x - s0.x, y: s2.y - s0.y };
        const uu = { x: t1.x - t0.x, y: t1.y - t0.y };
        const vv = { x: t2.x - t0.x, y: t2.y - t0.y };

        const det = u.x * v.y - v.x * u.y;
        if (Math.abs(det) < 1e-9) return null;

        const a = (uu.x * v.y - vv.x * u.y) / det;
        const c = (vv.x * u.x - uu.x * v.x) / det;
        const b = (uu.y * v.y - vv.y * u.y) / det;
        const d = (vv.y * u.x - uu.y * v.x) / det;

        const tx = t0.x - (a * s0.x + c * s0.y);
        const ty = t0.y - (b * s0.x + d * s0.y);

        return { a, b, c, d, tx, ty };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DistortWarp;
}
