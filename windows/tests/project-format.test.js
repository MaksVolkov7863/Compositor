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
                        outerGlow: { size: 10, opacity: 0.8, color: '#ffff00' },
                        innerGlow: { size: 15, opacity: 0.75, red: 1, green: 1, blue: 1 }
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
        assert.ok(l0.effects.innerGlow);
        assert.equal(l0.effects.innerGlow.size, 15);

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

    test('Manifest strictly validates against manifest.schema.json specification', async () => {
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.resolve(__dirname, '../src/manifest.schema.json');
        assert.ok(fs.existsSync(schemaPath), 'manifest.schema.json must exist');
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

        // Lightweight recursive JSON Schema validator for core constraints
        function validateObject(obj, schemaNode, pathPrefix = 'root') {
            const errors = [];
            if (schemaNode.required) {
                for (const req of schemaNode.required) {
                    if (obj[req] === undefined) {
                        errors.push(`${pathPrefix}: missing required property "${req}"`);
                    }
                }
            }
            if (schemaNode.properties) {
                for (const [prop, propSchema] of Object.entries(schemaNode.properties)) {
                    const val = obj[prop];
                    if (val === undefined) continue;
                    const curPath = `${pathPrefix}.${prop}`;

                    // Type check
                    if (propSchema.type) {
                        const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
                        const isInt = typeof val === 'number' && Number.isInteger(val);
                        const isNum = typeof val === 'number';
                        const matchesType = types.some(t => {
                            if (t === 'integer') return isInt;
                            if (t === 'number') return isNum;
                            if (t === 'array') return Array.isArray(val);
                            if (t === 'null') return val === null;
                            return typeof val === t;
                        });
                        if (!matchesType) {
                            errors.push(`${curPath}: expected type [${types.join(', ')}], got ${typeof val}`);
                        }
                    }
                    if (propSchema.const !== undefined && val !== propSchema.const) {
                        errors.push(`${curPath}: expected const "${propSchema.const}", got "${val}"`);
                    }
                    if (propSchema.minimum !== undefined && typeof val === 'number' && val < propSchema.minimum) {
                        errors.push(`${curPath}: value ${val} is below minimum ${propSchema.minimum}`);
                    }
                    if (propSchema.maximum !== undefined && typeof val === 'number' && val > propSchema.maximum) {
                        errors.push(`${curPath}: value ${val} is above maximum ${propSchema.maximum}`);
                    }
                    if (propSchema.enum && !propSchema.enum.includes(val)) {
                        errors.push(`${curPath}: value "${val}" not in enum [${propSchema.enum.join(', ')}]`);
                    }
                    if (propSchema.type === 'object' && typeof val === 'object' && val !== null) {
                        errors.push(...validateObject(val, propSchema, curPath));
                    }
                    if (propSchema.type === 'array' && Array.isArray(val) && propSchema.items) {
                        val.forEach((item, idx) => {
                            if (typeof item === 'object' && item !== null) {
                                errors.push(...validateObject(item, propSchema.items, `${curPath}[${idx}]`));
                            }
                        });
                    }
                }
            }
            return errors;
        }

        // 1. Serialize sample project and validate against schema
        const sampleProject = {
            uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            width: 1280,
            height: 720,
            resolution: 72,
            activeLayerId: 'layer-1',
            guides: {
                horizontal: [100],
                vertical: [200]
            },
            layers: [
                {
                    id: 'layer-1',
                    name: 'Base Layer',
                    visible: true,
                    opacity: 1.0,
                    blendMode: 'Normal',
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 720,
                    rotation: 0,
                    flipX: false,
                    flipY: false,
                    effects: {
                        innerGlow: { size: 10, opacity: 0.5, choke: 0.2, red: 1, green: 1, blue: 1 }
                    }
                }
            ]
        };

        const zipBase64 = await ProjectStore.serializeProject(sampleProject, JSZip);
        const zip = await JSZip.loadAsync(zipBase64, { base64: true });
        const manifest = JSON.parse(await zip.file('manifest.json').async('string'));

        const validationErrors = validateObject(manifest, schema);
        assert.deepEqual(validationErrors, [], `Serialized manifest must pass schema validation: ${validationErrors.join('; ')}`);

        // 2. Corrupt manifest must produce schema validation errors
        const invalidManifest = {
            format: 'invalid.format',
            version: 99, // exceeds maximum 9
            layers: [
                {
                    // missing required 'name'
                    opacity: 2.5 // exceeds maximum 1.0
                }
            ],
            guides: [
                { axis: 'diagonal', position: 50 } // invalid enum
            ]
        };

        const errors = validateObject(invalidManifest, schema);
        assert.ok(errors.some(e => e.includes('format')), 'Must flag invalid format');
        assert.ok(errors.some(e => e.includes('version')), 'Must flag invalid version');
        assert.ok(errors.some(e => e.includes('missing required property "name"')), 'Must flag missing name');
        assert.ok(errors.some(e => e.includes('maximum 1')), 'Must flag invalid opacity');
        assert.ok(errors.some(e => e.includes('enum')), 'Must flag invalid guide axis');
    });
});

