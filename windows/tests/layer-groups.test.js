const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompositorEngine = require('../src/engine.js');

describe('Layer Groups & Hierarchy (Mac GroupTests Parity)', () => {
    test('Nested groups, collapse expansion, moving out of group and cascading deletion', () => {
        const engine = CompositorEngine.createHeadless(100, 100);

        // 1. Create outer group
        const outer = engine.addGroup('Outer Group');
        assert.equal(outer.isGroup, true);
        assert.equal(outer.collapsed, false);
        assert.equal(outer.parentId, null);

        // 2. Create inner group inside outer
        const inner = engine.addGroup('Inner Group');
        assert.equal(engine.placeLayer(inner.id, outer.id), true);
        assert.equal(inner.parentId, outer.id);

        // Prevent circular hierarchy
        assert.equal(engine.placeLayer(outer.id, inner.id), false, 'Outer group cannot be placed into its own child');
        assert.equal(engine.placeLayer(inner.id, inner.id), false, 'Group cannot be placed into itself');

        // 3. Add child layer to inner group
        const child = engine.addLayer('Child Artwork');
        assert.equal(engine.placeLayer(child.id, inner.id), true);
        assert.equal(child.parentId, inner.id);

        // 4. Toggle collapse / expansion
        engine.toggleGroupExpansion(outer.id);
        assert.equal(outer.collapsed, true);
        engine.toggleGroupExpansion(outer.id);
        assert.equal(outer.collapsed, false);

        // 5. Move active layer out of group (inner -> outer -> root)
        engine.activeLayerId = child.id;
        engine.moveActiveLayerOutOfGroup();
        assert.equal(child.parentId, outer.id, 'Moving out of inner group moves to outer group');

        engine.moveActiveLayerOutOfGroup();
        assert.equal(child.parentId, null, 'Moving out of outer group moves to root');

        // Put child back into inner
        assert.equal(engine.placeLayer(child.id, inner.id), true);
        assert.equal(child.parentId, inner.id);

        // 6. Cascading deletion: deleting outer group deletes inner group and its child
        engine.activeLayerId = outer.id;
        engine.deleteActiveLayer();

        assert.equal(engine.layers.some(l => l.id === outer.id), false, 'Outer group must be deleted');
        assert.equal(engine.layers.some(l => l.id === inner.id), false, 'Inner group must be deleted');
        assert.equal(engine.layers.some(l => l.id === child.id), false, 'Child of deleted group must be deleted');
    });

    test('Hidden parent group overrides children rendering while preserving child flags', () => {
        const engine = CompositorEngine.createHeadless(50, 50);

        // Create group and child layer
        const group = engine.addGroup('Icon Folder');
        const child = engine.addLayer('Vector Graphic');
        engine.placeLayer(child.id, group.id);

        // Draw solid red on child layer
        child.ctx.fillStyle = '#ff0000';
        child.ctx.fillRect(0, 0, 50, 50);

        engine.render();
        let pixel = engine.canvas.getContext('2d').getImageData(25, 25, 1, 1).data;
        assert.equal(pixel[0], 255, 'Child must render when group is visible');
        assert.equal(pixel[3], 255);

        // Hide parent group
        group.visible = false;
        assert.equal(child.visible, true, 'Child own visibility flag remains untouched');

        engine.render();
        pixel = engine.canvas.getContext('2d').getImageData(25, 25, 1, 1).data;
        assert.equal(pixel[3], 0, 'Child must not render when parent group is hidden');

        // Unhide parent group restores rendering
        group.visible = true;
        engine.render();
        pixel = engine.canvas.getContext('2d').getImageData(25, 25, 1, 1).data;
        assert.equal(pixel[0], 255, 'Child rendering must restore when group is visible again');
        assert.equal(pixel[3], 255);
    });

    test('Parent group opacity dims children with multiplicative composite opacity', () => {
        const engine = CompositorEngine.createHeadless(40, 40);

        const group = engine.addGroup('Dimmed Folder');
        group.opacity = 0.5;

        const child = engine.addLayer('Graphic');
        engine.placeLayer(child.id, group.id);
        child.opacity = 0.8;

        // Child own opacity flag remains 0.8
        assert.equal(child.opacity, 0.8);
        assert.equal(group.opacity, 0.5);

        // Draw white
        child.ctx.fillStyle = '#ffffff';
        child.ctx.fillRect(0, 0, 40, 40);

        engine.render();
        const pixel = engine.canvas.getContext('2d').getImageData(20, 20, 1, 1).data;

        // Multiplied alpha: 0.5 * 0.8 = 0.40 -> ~102 out of 255
        const expectedAlpha = Math.round(0.4 * 255);
        assert.ok(
            Math.abs(pixel[3] - expectedAlpha) <= 3,
            `Rendered alpha (${pixel[3]}) must reflect cascaded opacity ~${expectedAlpha}`
        );
    });
});
