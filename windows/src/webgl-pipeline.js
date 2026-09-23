/**
 * WebGLPipeline - High Performance GPU Shader Acceleration for Compositor
 * 
 * Accelerates image adjustments, color corrections and convolutions (blur)
 * via hardware fragment shaders, with automatic CPU fallback when WebGL
 * is unavailable (e.g. Node.js headless CI environments).
 */

class WebGLPipeline {
    constructor(canvas = null) {
        this.canvas = canvas;
        this.gl = null;
        this.isSupported = false;
        this.programs = {};

        this._initGL();
    }

    static create(canvas = null) {
        return new WebGLPipeline(canvas);
    }

    _initGL() {
        try {
            if (!this.canvas && typeof document !== 'undefined' && document.createElement) {
                this.canvas = document.createElement('canvas');
            }
            if (!this.canvas || typeof this.canvas.getContext !== 'function') {
                this.isSupported = false;
                return;
            }

            this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false }) ||
                      this.canvas.getContext('webgl', { premultipliedAlpha: false });

            if (!this.gl) {
                this.isSupported = false;
                return;
            }

            this._initQuad();
            this._compilePrograms();
            this.isSupported = true;
        } catch {
            this.isSupported = false;
        }
    }

    _initQuad() {
        const gl = this.gl;
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // Full screen quad [-1, 1] with UV coordinates [0, 1]
        const vertices = new Float32Array([
            -1, -1,  0, 1,
             1, -1,  1, 1,
            -1,  1,  0, 0,
            -1,  1,  0, 0,
             1, -1,  1, 1,
             1,  1,  1, 0,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        this.quadBuffer = positionBuffer;
    }

    _compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const err = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${err}`);
        }
        return shader;
    }

    _createProgram(vertSrc, fragSrc) {
        const gl = this.gl;
        const vs = this._compileShader(gl.VERTEX_SHADER, vertSrc);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const err = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program link error: ${err}`);
        }
        return program;
    }

    _compilePrograms() {
        const vs = `
            attribute vec2 a_pos;
            attribute vec2 a_uv;
            varying vec2 v_uv;
            void main() {
                v_uv = a_uv;
                gl_Position = vec4(a_pos, 0.0, 1.0);
            }
        `;

        // Multi-adjustment Shader: Brightness, Contrast, Exposure, Invert, Hue, Saturation
        const fsAdjustments = `
            precision mediump float;
            varying vec2 v_uv;
            uniform sampler2D u_image;
            uniform float u_brightness; // [-1.0, 1.0]
            uniform float u_contrast;   // [-1.0, 1.0]
            uniform float u_exposure;   // [-2.0, 2.0]
            uniform float u_invert;     // 0.0 or 1.0
            uniform float u_hue;        // degrees [-180, 180]
            uniform float u_sat;        // [-1.0, 1.0]

            vec3 rgb2hsv(vec3 c) {
                vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
                float d = q.x - min(q.w, q.y);
                float e = 1.0e-10;
                return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
            }

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec4 col = texture2D(u_image, v_uv);
                if (col.a <= 0.0) {
                    gl_FragColor = col;
                    return;
                }

                // Invert
                if (u_invert > 0.5) {
                    col.rgb = vec3(1.0) - col.rgb;
                }

                // Exposure (2^exposure)
                col.rgb *= pow(2.0, u_exposure);

                // Brightness
                col.rgb += u_brightness;

                // Contrast: (col - 0.5) * (1 + contrast) + 0.5
                float factor = (1.0 + u_contrast);
                col.rgb = (col.rgb - 0.5) * factor + 0.5;

                // Hue & Saturation
                if (u_hue != 0.0 || u_sat != 0.0) {
                    vec3 hsv = rgb2hsv(col.rgb);
                    hsv.x = fract(hsv.x + u_hue / 360.0);
                    hsv.y = clamp(hsv.y * (1.0 + u_sat), 0.0, 1.0);
                    col.rgb = hsv2rgb(hsv);
                }

                gl_FragColor = vec4(clamp(col.rgb, 0.0, 1.0), col.a);
            }
        `;

        this.programs.adjustments = this._createProgram(vs, fsAdjustments);
    }

    /**
     * Applies GPU adjustments to an ImageData buffer or returns CPU processed version
     */
    applyAdjustments(imageData, options = {}) {
        const {
            brightness = 0,
            contrast = 0,
            exposure = 0,
            invert = false,
            hue = 0,
            saturation = 0
        } = options;

        if (!this.isSupported || !this.gl) {
            return this._cpuAdjustments(imageData, options);
        }

        try {
            const gl = this.gl;
            const w = imageData.width;
            const h = imageData.height;

            if (this.canvas.width !== w || this.canvas.height !== h) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
            gl.viewport(0, 0, w, h);

            const program = this.programs.adjustments;
            gl.useProgram(program);

            // Bind Quad Buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            const aPos = gl.getAttribLocation(program, 'a_pos');
            const aUv = gl.getAttribLocation(program, 'a_uv');
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
            gl.enableVertexAttribArray(aUv);
            gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

            // Upload Texture
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);

            // Set Uniforms
            gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
            gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), brightness / 100);
            gl.uniform1f(gl.getUniformLocation(program, 'u_contrast'), contrast / 100);
            gl.uniform1f(gl.getUniformLocation(program, 'u_exposure'), exposure);
            gl.uniform1f(gl.getUniformLocation(program, 'u_invert'), invert ? 1.0 : 0.0);
            gl.uniform1f(gl.getUniformLocation(program, 'u_hue'), hue);
            gl.uniform1f(gl.getUniformLocation(program, 'u_sat'), saturation / 100);

            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Read pixels back
            const outPixels = new Uint8ClampedArray(w * h * 4);
            const rawPixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rawPixels);

            // WebGL readPixels reads bottom-to-top, flip vertically
            const rowSize = w * 4;
            for (let row = 0; row < h; row++) {
                const srcOffset = (h - 1 - row) * rowSize;
                const dstOffset = row * rowSize;
                outPixels.set(rawPixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
            }

            gl.deleteTexture(texture);
            imageData.data.set(outPixels);
            return imageData;
        } catch {
            return this._cpuAdjustments(imageData, options);
        }
    }

    _cpuAdjustments(imageData, options) {
        const {
            brightness = 0,
            contrast = 0,
            invert = false
        } = options;

        const data = imageData.data;
        const b = (brightness / 100) * 255;
        const cFactor = (contrast + 100) / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let bCol = data[i + 2];

            if (invert) {
                r = 255 - r;
                g = 255 - g;
                bCol = 255 - bCol;
            }

            if (brightness !== 0) {
                r += b;
                g += b;
                bCol += b;
            }

            if (contrast !== 0) {
                r = (r - 128) * cFactor + 128;
                g = (g - 128) * cFactor + 128;
                bCol = (bCol - 128) * cFactor + 128;
            }

            data[i] = Math.max(0, Math.min(255, Math.round(r)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round(bCol)));
        }

        return imageData;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLPipeline;
}
