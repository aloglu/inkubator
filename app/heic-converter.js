(function () {
    const HEIC_BRANDS = new Set(['mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'avic', 'avif']);
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

    async function getLibheifModule() {
        if (!libheifModulePromise) {
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

    function encodePng({ width, height, data }) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Canvas is not available for HEIC conversion.'));
                return;
            }
            context.putImageData(new ImageData(data, width, height), 0, 0);
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('Could not encode converted HEIC image.'));
                    return;
                }
                resolve(new Uint8Array(await blob.arrayBuffer()));
            }, 'image/png');
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

        return encodePng(await displayImage(images[0]));
    }

    window.inkubatorHeic = {
        hasHeicExtension,
        isHeicBytes,
        convertBytesToPng
    };
})();
