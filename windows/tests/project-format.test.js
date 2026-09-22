const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const ProjectStore = require('../src/project-store.js');

describe('Compositor Project (.comp) Format Specification', () => {
    test('UUID generator produces valid RFC 4122 v4 format strings', () => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        for (let i = 0; i < 20; i++) {
            const id = ProjectStore.generateUUID();
            assert.match(id, uuidRegex, `Generated UUID ${id} must conform to RFC 4122 v4`);
        }
    });

    test('Manifest adheres strictly to manifest v6 schema from docs/project-format.md', async () => {
        const mockProject = {
            uuid: 'd1234567-89ab-4cde-8f01-23456789abcd',
            width: 1920,
            height: 1080,
            resolution: 300,
            activeLayerId: 'layer-top-id',
            layers: [
                {
                    id: 'layer-bg-id',
                    name: 'Background',
                    visible: true,
                    opacity: 1.0,
                    blendMode: 'Normal',
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    rotation: 0,
                    flipX: false,
                    flipY: false
                },
                {
                    id: 'layer-top-id',
                    name: 'Shadow Layer',
                    visible: true,
                    opacity: 0.85,
                    blendMode: 'Multiply',
                    x: 100,
                    y: 150,
                    width: 500,
                    height: 400,
                    rotation: 15,
                    flipX: true,
                    flipY: false,
                    maskSourceId: 'layer-bg-id'
                }
            ]
        };

        const zipBase64 = await ProjectStore.serializeProject(mockProject, JSZip);
        const zip = await JSZip.loadAsync(zipBase64, { base64: true });

        const manifestFile = zip.file('manifest.json');
        assert.ok(manifestFile, 'Project archive must contain manifest.json');

        const manifest = JSON.parse(await manifestFile.async('string'));

        // Validate v6 schema keys
        assert.equal(manifest.format, 'com.compositor.project');
        assert.equal(manifest.version, 6);
        assert.equal(manifest.uuid, mockProject.uuid);
        assert.equal(manifest.dimensions.width, 1920);
        assert.equal(manifest.dimensions.height, 1080);
        assert.equal(manifest.resolution, 300);
        assert.equal(manifest.activeLayerUUID, 'layer-top-id');
        assert.equal(manifest.layers.length, 2);

        // Validate layer 0
        const l0 = manifest.layers[0];
        assert.equal(l0.uuid, 'layer-bg-id');
        assert.equal(l0.name, 'Background');
        assert.equal(l0.opacity, 1.0);
        assert.equal(l0.blendMode, 'Normal');
        assert.equal(l0.transform.width, 1920);

        // Validate layer 1
        const l1 = manifest.layers[1];
        assert.equal(l1.uuid, 'layer-top-id');
        assert.equal(l1.name, 'Shadow Layer');
        assert.equal(l1.opacity, 0.85);
        assert.equal(l1.blendMode, 'Multiply');
        assert.equal(l1.transform.x, 100);
        assert.equal(l1.transform.y, 150);
        assert.equal(l1.transform.rotation, 15);
        assert.equal(l1.transform.flipX, true);
        assert.equal(l1.maskSourceID, 'layer-bg-id');
    });

    test('Deserializing without manifest.json throws an informative error', async () => {
        const emptyZip = new JSZip();
        emptyZip.file('dummy.txt', 'hello');
        const base64 = await emptyZip.generateAsync({ type: 'base64' });

        await assert.rejects(
            async () => {
                await ProjectStore.deserializeProject(base64, JSZip);
            },
            {
                name: 'Error',
                message: /missing manifest\.json/
            }
        );
    });
});
