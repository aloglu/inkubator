(function () {
    const HEIC_BRANDS = new Set(['mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'avic', 'avif']);
    let libheifScriptPromise = null;
    let libheifModulePromise = null;

    function hasHeicExtension(value) {
        return /\.(heic|heif)$/i.test(String(value || '').split(/[?#]/)[0]);
    }

    function isHeicBytes(bytes) {
        if (!bytes || bytes.length < 12) return false;
        const header = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
        if (header !== 'ftyp') return false;

        for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
            const brand = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
            if (HEIC_BRANDS.has(brand)) return true;
        }
        return false;
    }

    function loadLibheifScript() {
        if (typeof window.libheif === 'function') return Promise.resolve();
        if (!libheifScriptPromise) {
            libheifScriptPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = new URL('assets/heic/libheif-bundle.js', document.baseURI).href;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('HEIC decoder could not be loaded.'));
                document.head.appendChild(script);
            });
        }
        return libheifScriptPromise;
    }

    async function getLibheifModule() {
        if (!libheifModulePromise) {
            await loadLibheifScript();
            if (typeof window.libheif !== 'function') {
                throw new Error('HEIC decoder is not available.');
            }
            libheifModulePromise = Promise.resolve(window.libheif()).then((module) => {
                const resolved = module && module.default ? module.default : module;
                if (!resolved || typeof resolved.HeifDecoder !== 'function') {
                    throw new Error('HEIC decoder failed to initialize.');
                }
                return resolved;
            });
        }
        return libheifModulePromise;
    }

    function displayImage(image) {
        const width = image.get_width();
        const height = image.get_height();
        const rgba = new Uint8ClampedArray(width * height * 4);
        const target = { data: rgba, width, height };

        return new Promise((resolve, reject) => {
            image.display(target, (displayData) => {
                if (!displayData) {
                    reject(new Error('Could not decode HEIC image pixels.'));
                    return;
                }
                resolve({ width, height, data: displayData.data || rgba });
            });
        });
    }

    function encodeCanvas({ width, height, data }, options = {}) {
        return new Promise((resolve, reject) => {
            const maxSize = Number.isFinite(Number(options.maxSize)) && Number(options.maxSize) > 0
                ? Number(options.maxSize)
                : Math.max(width, height);
            const scale = Math.min(1, maxSize / Math.max(width, height));
            const targetWidth = Math.max(1, Math.round(width * scale));
            const targetHeight = Math.max(1, Math.round(height * scale));
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = width;
            sourceCanvas.height = height;
            const sourceContext = sourceCanvas.getContext('2d');
            if (!sourceContext) {
                reject(new Error('Canvas is not available for HEIC conversion.'));
                return;
            }
            sourceContext.putImageData(new ImageData(data, width, height), 0, 0);

            let outputCanvas = sourceCanvas;
            if (targetWidth !== width || targetHeight !== height) {
                outputCanvas = document.createElement('canvas');
                outputCanvas.width = targetWidth;
                outputCanvas.height = targetHeight;
                const outputContext = outputCanvas.getContext('2d');
                if (!outputContext) {
                    reject(new Error('Canvas is not available for HEIC conversion.'));
                    return;
                }
                outputContext.imageSmoothingEnabled = true;
                outputContext.imageSmoothingQuality = 'high';
                outputContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
            }

            outputCanvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('Could not encode converted HEIC image.'));
                    return;
                }
                resolve(new Uint8Array(await blob.arrayBuffer()));
            }, options.type || 'image/png', options.quality);
        });
    }

    async function convertBytesToPng(bytes) {
        const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        if (!isHeicBytes(input)) {
            throw new Error('Selected file is not a HEIC/HEIF image.');
        }

        const libheif = await getLibheifModule();
        const decoder = new libheif.HeifDecoder();
        const images = decoder.decode(input);
        if (!images || !images.length) {
            throw new Error('No image frames were found in the HEIC/HEIF file.');
        }

        return encodeCanvas(await displayImage(images[0]), { type: 'image/png' });
    }

    async function convertBytesToWebp(bytes, options = {}) {
        const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        if (!isHeicBytes(input)) {
            throw new Error('Selected file is not a HEIC/HEIF image.');
        }

        const libheif = await getLibheifModule();
        const decoder = new libheif.HeifDecoder();
        const images = decoder.decode(input);
        if (!images || !images.length) {
            throw new Error('No image frames were found in the HEIC/HEIF file.');
        }

        const maxSize = Number.isFinite(Number(options.maxSize)) && Number(options.maxSize) > 0
            ? Number(options.maxSize)
            : 1200;
        const quality = Number.isFinite(Number(options.quality))
            ? Math.min(1, Math.max(0, Number(options.quality)))
            : 0.88;
        return encodeCanvas(await displayImage(images[0]), {
            type: 'image/webp',
            quality,
            maxSize
        });
    }

    window.inkubatorHeic = {
        hasHeicExtension,
        isHeicBytes,
        convertBytesToPng,
        convertBytesToWebp
    };
})();
