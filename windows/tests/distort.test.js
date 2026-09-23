const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const DistortWarp = require('../src/distort-warp.js');

describe('DistortWarp Perspective Geometry (Mac DistortTests Parity)', () => {
    const shape = [
        { x: 10, y: 10 },
        { x: 60, y: 10 },
        { x: 30, y: 30 },
        { x: 10, y: 30 }
    ];

    test('Perspective homography mapping accurately maps unit square to destination corners', () => {
        const map = DistortWarp.homography(shape);
        const unitCorners = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 }
        ];

        for (let i = 0; i < 4; i++) {
            const mapped = map(unitCorners[i]);
            const expected = shape[i];
            assert.ok(
                Math.abs(mapped.x - expected.x) < 1e-6,
                `Corner ${i} X mismatch: expected ${expected.x}, got ${mapped.x}`
            );
            assert.ok(
                Math.abs(mapped.y - expected.y) < 1e-6,
                `Corner ${i} Y mismatch: expected ${expected.y}, got ${mapped.y}`
            );
        }

        assert.equal(DistortWarp.isUsable(shape), true, 'Valid trapezoid shape must be usable');
        assert.equal(DistortWarp.isConvex(shape), true, 'Valid trapezoid shape must be convex');
    });

    test('Bow-tie crossed polygon is usable (folded warp) but not convex', () => {
        // Crossed corners: [0, 2, 1, 3] creates an hourglass / bow-tie
        const bowTie = [shape[0], shape[2], shape[1], shape[3]];
        assert.equal(DistortWarp.isUsable(bowTie), true, 'Bow-tie shape with non-zero triangle areas is usable');
        assert.equal(DistortWarp.isConvex(bowTie), false, 'Bow-tie shape is self-intersecting and not convex');
    });

    test('Degenerate collapsed shape with zero area is rejected', () => {
        // Collapsed corner: shape[0] duplicated leaves half with 0 area
        const collapsed = [shape[0], shape[0], shape[2], shape[3]];
        assert.equal(DistortWarp.isUsable(collapsed), false, 'Collapsed shape must be refused as unusable');
        assert.equal(DistortWarp.isConvex(collapsed), false, 'Collapsed shape cannot be convex');
    });

    test('Transform corners helper computes correct quad coordinates with rotation and scale', () => {
        const transform = {
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            flipX: false,
            flipY: false
        };

        const corners = DistortWarp.corners(transform);
        assert.equal(corners.length, 4);
        assert.deepEqual(corners[0], { x: 50, y: 50 });    // TL
        assert.deepEqual(corners[1], { x: 150, y: 50 });   // TR
        assert.deepEqual(corners[2], { x: 150, y: 150 });  // BR
        assert.deepEqual(corners[3], { x: 50, y: 150 });   // BL

        assert.equal(DistortWarp.isConvex(corners), true);
    });

    test('Affine 3-point mapping solves exact 2D transformation matrix', () => {
        const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
        const dst = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 5, y: 15 }];

        const matrix = DistortWarp.affine(src, dst);
        assert.ok(matrix !== null);
        assert.equal(matrix.a, 1);
        assert.equal(matrix.d, 1);
        assert.equal(matrix.tx, 5);
        assert.equal(matrix.ty, 5);
    });
});
