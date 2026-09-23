/**
 * PSDReader - Photoshop PSD (8BPS) Binary Format Parser and Fixture Builder
 * 
 * Matches Swift PSDReader & PSDFixture (Compositor/Import/PSDReader.swift & PSDFixture.swift)
 */

class PSDReader {
    static get BLEND_KEYS() {
        return {
            'norm': 'Normal',
            'mul ': 'Multiply',
            'scrn': 'Screen',
            'over': 'Overlay',
            'dark': 'Darken',
            'lite': 'Lighten',
            'diff': 'Difference',
            'smud': 'Exclusion',
            'sLit': 'Soft Light',
            'hLit': 'Hard Light',
            'colr': 'Color',
            'lum ': 'Luminosity',
            'hue ': 'Hue',
            'sat ': 'Saturation'
        };
    }

    /**
     * Parses an 8BPS Photoshop document binary buffer
     * @param {Buffer|Uint8Array} buf
     */
    static read(buf) {
        const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        if (buffer.length < 4) {
            throw new Error('Invalid PSD: File too small');
        }

        const signature = buffer.toString('utf8', 0, 4);
        if (signature !== '8BPS') {
            throw new Error(`Invalid PSD signature: expected 8BPS, got ${signature}`);
        }

        if (buffer.length < 26) {
            throw new Error('Invalid PSD: File too small for header');
        }

        const version = buffer.readUInt16BE(4);
        if (version !== 1 && version !== 2) {
            throw new Error(`Unsupported PSD version: ${version}`);
        }

        const channels = buffer.readUInt16BE(12);
        const height = buffer.readUInt32BE(14);
        const width = buffer.readUInt32BE(18);
        const depth = buffer.readUInt16BE(22);
        const colorMode = buffer.readUInt16BE(24);

        let offset = 26;

        // Color Mode Data Section
        const colorModeLen = buffer.readUInt32BE(offset);
        offset += 4 + colorModeLen;

        // Image Resources Section
        let resolution = 72;
        if (offset + 4 <= buffer.length) {
            const resourcesLen = buffer.readUInt32BE(offset);
            offset += 4;
            const resEnd = offset + resourcesLen;
            while (offset + 12 <= resEnd && offset + 12 <= buffer.length) {
                const resSig = buffer.toString('utf8', offset, offset + 4);
                if (resSig !== '8BIM') break;
                const resID = buffer.readUInt16BE(offset + 4);
                offset += 6;
                // Pascal string name padded to even
                const nameLen = buffer.readUInt8(offset);
                offset += 1 + nameLen;
                if ((nameLen + 1) % 2 !== 0) offset++;
                if (offset + 4 > buffer.length) break;
                const dataSize = buffer.readUInt32BE(offset);
                offset += 4;
                if (resID === 0x03ED && dataSize >= 4) { // ResolutionInfo
                    resolution = buffer.readUInt16BE(offset);
                }
                offset += dataSize;
                if (dataSize % 2 !== 0) offset++;
            }
            offset = resEnd;
        }

        // Layer and Mask Information Section
        const layers = [];
        if (offset + 4 <= buffer.length) {
            const layerSectionLen = buffer.readUInt32BE(offset);
            offset += 4;
            const layerSectionEnd = offset + layerSectionLen;
            if (layerSectionLen >= 4 && offset + 4 <= buffer.length) {
                const layerInfoLen = buffer.readUInt32BE(offset);
                offset += 4;
                if (layerInfoLen > 0 && offset + 2 <= buffer.length) {
                    const layerCount = Math.abs(buffer.readInt16BE(offset));
                    offset += 2;

                for (let i = 0; i < layerCount; i++) {
                    if (offset + 34 > buffer.length) break;
                    const top = buffer.readInt32BE(offset);
                    const left = buffer.readInt32BE(offset + 4);
                    const bottom = buffer.readInt32BE(offset + 8);
                    const right = buffer.readInt32BE(offset + 12);
                    const numChannels = buffer.readUInt16BE(offset + 16);
                    offset += 18;

                    // Skip channel info (6 bytes per channel: 2 ID + 4 length)
                    offset += numChannels * 6;

                    // Blend mode signature
                    const blendSig = buffer.toString('utf8', offset, offset + 4);
                    const blendKey = buffer.toString('utf8', offset + 4, offset + 8);
                    const opacity = buffer.readUInt8(offset + 8) / 255;
                    const clipping = buffer.readUInt8(offset + 9);
                    const flags = buffer.readUInt8(offset + 10);
                    const isVisible = (flags & 2) === 0; // bit 1: 0 = visible, 1 = hidden
                    offset += 12;

                    // Extra data
                    const extraLen = buffer.readUInt32BE(offset);
                    offset += 4;
                    const extraEnd = offset + extraLen;

                    // Layer Mask Data length
                    const maskLen = buffer.readUInt32BE(offset);
                    offset += 4 + maskLen;

                    // Layer Blending Ranges length
                    const blendRangeLen = buffer.readUInt32BE(offset);
                    offset += 4 + blendRangeLen;

                    // Layer Name: Pascal string
                    let layerName = `Layer ${i + 1}`;
                    if (offset < extraEnd) {
                        const nameByteLen = buffer.readUInt8(offset);
                        offset += 1;
                        if (nameByteLen > 0 && offset + nameByteLen <= buffer.length) {
                            layerName = buffer.toString('utf8', offset, offset + nameByteLen);
                            offset += nameByteLen;
                        }
                    }

                    offset = extraEnd;

                    layers.push({
                        name: layerName,
                        bounds: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) },
                        blendKey,
                        blendMode: PSDReader.BLEND_KEYS[blendKey] || 'Normal',
                        opacity: Math.max(0, Math.min(1, opacity)),
                        isVisible,
                        clipping: clipping === 1
                    });
                }
            }
            offset = layerSectionEnd;
        }
        }

        return {
            signature,
            version,
            channels,
            width,
            height,
            depth,
            colorMode,
            resolution,
            layers
        };
    }

    /**
     * Converts parsed PSD document to Compositor Engine layers
     */
    static toCompositorLayers(psdDoc) {
        return psdDoc.layers.map((l, index) => ({
            id: `psd_layer_${index + 1}`,
            name: l.name,
            x: l.bounds.x,
            y: l.bounds.y,
            width: l.bounds.width,
            height: l.bounds.height,
            opacity: l.opacity,
            visible: l.isVisible,
            blendMode: l.blendMode
        }));
    }
}

/**
 * PSDFixture - Builder for valid 8BPS Photoshop binary buffers for tests
 */
class PSDFixture {
    static data(doc) {
        const width = doc.width || 8;
        const height = doc.height || 8;
        const resolution = doc.resolution || 72;
        const layers = doc.layers || [];

        const parts = [];

        // 1. Header (26 bytes)
        const header = Buffer.alloc(26);
        header.write('8BPS', 0, 'utf8');
        header.writeUInt16BE(1, 4); // version 1
        header.fill(0, 6, 12);      // reserved 6 bytes
        header.writeUInt16BE(3, 12); // 3 channels (RGB)
        header.writeUInt32BE(height, 14);
        header.writeUInt32BE(width, 18);
        header.writeUInt16BE(8, 22); // 8-bit depth
        header.writeUInt16BE(3, 24); // ColorMode 3 = RGB
        parts.push(header);

        // 2. Color Mode Data Section (4 bytes: 0 length)
        const colorModeData = Buffer.alloc(4);
        colorModeData.writeUInt32BE(0, 0);
        parts.push(colorModeData);

        // 3. Image Resources Section (ResolutionInfo: ID 0x03ED = 1005)
        const resBlock = Buffer.alloc(16);
        resBlock.write('8BIM', 0, 'utf8');
        resBlock.writeUInt16BE(0x03ED, 4); // ResolutionInfo
        resBlock.writeUInt16BE(0, 6);       // Empty name (even padded)
        resBlock.writeUInt32BE(4, 8);       // 4 bytes payload
        resBlock.writeUInt16BE(resolution, 12);
        resBlock.writeUInt16BE(0, 14);

        const resSection = Buffer.alloc(4);
        resSection.writeUInt32BE(resBlock.length, 0);
        parts.push(resSection);
        parts.push(resBlock);

        // 4. Layer & Mask Information Section
        const layerRecordsBufs = [];
        for (let i = 0; i < layers.length; i++) {
            const l = layers[i];
            const bounds = l.bounds || { x: 0, y: 0, width, height };
            const top = bounds.y;
            const left = bounds.x;
            const bottom = bounds.y + bounds.height;
            const right = bounds.x + bounds.width;

            const nameBuf = Buffer.from(l.name || `Layer ${i + 1}`, 'utf8');
            const nameLen = Math.min(255, nameBuf.length);
            const namePaddedLen = 1 + nameLen + (4 - ((1 + nameLen) % 4)) % 4;
            const nameField = Buffer.alloc(namePaddedLen);
            nameField.writeUInt8(nameLen, 0);
            nameBuf.copy(nameField, 1, 0, nameLen);

            const extraLen = 4 + 4 + nameField.length; // mask (4) + blend ranges (4) + name
            const rec = Buffer.alloc(18 + (3 * 6) + 12 + 4 + extraLen);

            let p = 0;
            rec.writeInt32BE(top, p); p += 4;
            rec.writeInt32BE(left, p); p += 4;
            rec.writeInt32BE(bottom, p); p += 4;
            rec.writeInt32BE(right, p); p += 4;
            rec.writeUInt16BE(3, p); p += 2; // 3 channels

            // Channels: Red (0), Green (1), Blue (2)
            for (let c = 0; c < 3; c++) {
                rec.writeInt16BE(c, p); p += 2;
                rec.writeUInt32BE(2, p); p += 4; // 2 bytes per channel (compression = 0)
            }

            rec.write('8BIM', p, 'utf8'); p += 4;
            const key = (l.blendKey || 'norm').padEnd(4, ' ').slice(0, 4);
            rec.write(key, p, 'utf8'); p += 4;
            rec.writeUInt8(Math.round((l.opacity !== undefined ? l.opacity : 1.0) * 255), p); p += 1;
            rec.writeUInt8(0, p); p += 1; // clipping
            const flags = l.isVisible === false ? 2 : 0;
            rec.writeUInt8(flags, p); p += 1;
            rec.writeUInt8(0, p); p += 1; // filler

            rec.writeUInt32BE(extraLen, p); p += 4;
            rec.writeUInt32BE(0, p); p += 4; // mask len
            rec.writeUInt32BE(0, p); p += 4; // blend ranges len
            nameField.copy(rec, p);

            layerRecordsBufs.push(rec);
        }

        const layerRecordsData = Buffer.concat(layerRecordsBufs);
        // Channel image dummy payloads (2 bytes compression: 0 raw)
        const channelPayloads = Buffer.alloc(layers.length * 3 * 2);

        const layerInfoLen = 2 + layerRecordsData.length + channelPayloads.length;
        const layerInfoBuf = Buffer.alloc(4 + 2);
        layerInfoBuf.writeUInt32BE(layerInfoLen, 0);
        layerInfoBuf.writeInt16BE(layers.length, 4);

        const totalLayerSection = Buffer.concat([
            layerInfoBuf,
            layerRecordsData,
            channelPayloads
        ]);

        const layerSectionHeader = Buffer.alloc(4);
        layerSectionHeader.writeUInt32BE(totalLayerSection.length, 0);
        parts.push(layerSectionHeader);
        parts.push(totalLayerSection);

        // 5. Image Data (composite)
        const imgDataHeader = Buffer.alloc(2);
        imgDataHeader.writeUInt16BE(0, 0); // raw compression
        parts.push(imgDataHeader);

        return Buffer.concat(parts);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PSDReader, PSDFixture };
}
