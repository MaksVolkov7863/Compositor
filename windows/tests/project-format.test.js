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

    test('Manifest adheres strictly to manifest v9 schema with guides, adjustments, shapes, text and effects', async () => {
        const mockProject = {
            uuid: 'd1234567-89ab-4cde-8f01-23456789abcd',
            width: 1920,
            height: 1080,
            resolution: 300,
            activeLayerId: 'layer-top-id',
            guides: {
                horizontal: [100, 500],
                vertical: [200, 600]
            },
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
                    flipY: false,
                    shape: {
                        kind: 'rectangle',
                        cornerRadius: 15
                    },
                    effects: {
                        outerGlow: { size: 10, opacity: 0.8, color: '#ffff00' }
                    }
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
                    maskSourceId: 'layer-bg-id',
                    liveText: {
                        content: 'Compositor v9',
                        font: 'Segoe UI',
                        fontSize: 36,
                        alignment: 'center'
                    }
                }
            ]
        };

        const zipBase64 = await ProjectStore.serializeProject(mockProject, JSZip);
        const zip = await JSZip.loadAsync(zipBase64, { base64: true });

        const manifestFile = zip.file('manifest.json');
        assert.ok(manifestFile, 'Project archive must contain manifest.json');

        const manifest = JSON.parse(await manifestFile.async('string'));

        // Validate v9 schema keys
        assert.equal(manifest.format, 'com.compositor.project');
        assert.equal(manifest.version, 9);
        assert.equal(manifest.uuid, mockProject.uuid);
        assert.equal(manifest.dimensions.width, 1920);
        assert.equal(manifest.dimensions.height, 1080);
        assert.equal(manifest.resolution, 300);
        assert.equal(manifest.activeLayerUUID, 'layer-top-id');
        assert.equal(manifest.layers.length, 2);

        // Validate guides
        assert.ok(Array.isArray(manifest.guides), 'Guides must be serialized as an array');
        assert.equal(manifest.guides.length, 4);
        assert.ok(manifest.guides.some(g => g.axis === 'horizontal' && g.position === 100));
        assert.ok(manifest.guides.some(g => g.axis === 'vertical' && g.position === 200));

        // Validate layer 0
        const l0 = manifest.layers[0];
        assert.equal(l0.uuid, 'layer-bg-id');
        assert.equal(l0.name, 'Background');
        assert.equal(l0.opacity, 1.0);
        assert.equal(l0.blendMode, 'Normal');
        assert.equal(l0.transform.width, 1920);
        assert.equal(l0.shape.kind, 'rectangle');
        assert.equal(l0.shape.cornerRadius, 15);
        assert.ok(l0.effects.outerGlow);

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
        assert.equal(l1.text.content, 'Compositor v9');
        assert.equal(l1.text.fontSize, 36);

        // Test roundtrip deserialization
        const restored = await ProjectStore.deserializeProject(zipBase64, JSZip);
        assert.equal(restored.width, 1920);
        assert.equal(restored.height, 1080);
        assert.equal(restored.resolution, 300);
        assert.equal(restored.version, 9);
        assert.deepEqual(restored.guides.horizontal, [100, 500]);
        assert.deepEqual(restored.guides.vertical, [200, 600]);
        assert.equal(restored.layers.length, 2);
        assert.equal(restored.layers[1].liveText.content, 'Compositor v9');
    });

    test('Backward compatibility: deserializing manifests from version 1 to 9', async () => {
        for (let ver = 1; ver <= 9; ver++) {
            const legacyManifest = {
                format: 'com.compositor.project',
                version: ver,
                uuid: `uuid-v${ver}`,
                dimensions: { width: 800, height: 600 },
                activeLayerUUID: 'layer-1',
                layers: [
                    {
                        uuid: 'layer-1',
                        name: `Layer v${ver}`,
                        transform: { x: 0, y: 0, width: 800, height: 600 }
                    }
                ]
            };

            const zip = new JSZip();
            zip.file('manifest.json', JSON.stringify(legacyManifest));
            const base64 = await zip.generateAsync({ type: 'base64' });

            const doc = await ProjectStore.deserializeProject(base64, JSZip);
            assert.equal(doc.version, ver);
            assert.equal(doc.width, 800);
            assert.equal(doc.height, 600);
            assert.equal(doc.layers.length, 1);
            assert.equal(doc.layers[0].name, `Layer v${ver}`);
        }
    });

    test('Rejects unsupported manifest version numbers (< 1 or > 9)', async () => {
        for (const badVer of [0, 10, -1, 42]) {
            const zip = new JSZip();
            zip.file('manifest.json', JSON.stringify({
                format: 'com.compositor.project',
                version: badVer,
                dimensions: { width: 500, height: 500 },
                layers: []
            }));
            const base64 = await zip.generateAsync({ type: 'base64' });

            await assert.rejects(
                async () => {
                    await ProjectStore.deserializeProject(base64, JSZip);
                },
                {
                    name: 'Error',
                    message: /Unsupported project format version/
                }
            );
        }
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
