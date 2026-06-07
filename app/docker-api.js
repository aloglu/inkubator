(function () {
    if (window.inkubatorAPI) return;

    const uploads = new Map();
    let uploadCounter = 0;

    function apiFetch(path, options = {}) {
        return fetch(path, {
            ...options,
            headers: {
                ...(options.headers || {}),
                ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
            }
        }).then(async (response) => {
            const text = await response.text();
            const payload = text ? JSON.parse(text) : null;
            if (!response.ok) {
                throw new Error((payload && payload.message) || `Request failed: ${response.status}`);
            }
            return payload;
        });
    }

    function bytesToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
    }

    function base64ToBytes(value) {
        const binary = atob(String(value || ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    function blobToImage(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not decode selected image.'));
            };
            image.src = url;
        });
    }

    async function imageBlobToWebpBase64(blob) {
        const image = await blobToImage(blob);
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available for image processing.');
        context.drawImage(image, 0, 0, width, height);
        const webpBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) resolve(result);
                else reject(new Error('Could not encode image.'));
            }, 'image/webp', 0.88);
        });
        return bytesToBase64(new Uint8Array(await webpBlob.arrayBuffer()));
    }

    function openImagePicker() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif';
            input.style.position = 'fixed';
            input.style.left = '-9999px';
            document.body.appendChild(input);
            input.addEventListener('change', () => {
                const file = input.files && input.files[0] ? input.files[0] : null;
                input.remove();
                if (!file) {
                    resolve(null);
                    return;
                }
                const safeName = String(file.name || 'upload')
                    .replace(/[^\w.\-()[\] ]+/g, '_')
                    .slice(0, 120) || 'upload';
                const token = `docker-upload:${Date.now()}-${uploadCounter += 1}/${safeName}`;
                uploads.set(token, file);
                resolve(token);
            }, { once: true });
            input.click();
        });
    }

    function openBackupDirectoryPicker() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/zip,.zip';
            input.style.position = 'fixed';
            input.style.left = '-9999px';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                const files = Array.from(input.files || []);
                input.remove();
                resolve(files[0] || null);
            }, { once: true });
            input.click();
        });
    }

    function uploadFileFor(path) {
        return uploads.get(path) || null;
    }

    async function readFileBase64(file) {
        return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    }

    async function downloadBackupZip() {
        const response = await fetch('/api/export-backup', { method: 'POST' });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || `Backup export failed: ${response.status}`);
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `inkubator-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return { success: true, path: filename };
    }

    async function saveUploadAsManagedImage(token, imageType, metadata) {
        const file = uploadFileFor(token);
        if (!file) throw new Error('Selected upload is no longer available.');
        const webpBase64 = await imageBlobToWebpBase64(file);
        return apiFetch('/api/save-image-bytes', {
            method: 'POST',
            body: JSON.stringify({
                bytesBase64: webpBase64,
                imageType,
                metadata,
                sourceHint: file.name || 'upload.webp'
            })
        });
    }

    window.inkubatorAPI = {
        loadData: () => apiFetch('/api/data'),
        saveData: (data) => apiFetch('/api/data', { method: 'POST', body: JSON.stringify({ data }) }),
        saveImage: (path, type, metadata) => {
            if (String(path || '').startsWith('docker-upload:')) {
                return saveUploadAsManagedImage(path, type, metadata);
            }
            throw new Error('Docker mode can only save browser-selected image uploads.');
        },
        saveImageBytes: async (bytesBase64, type, metadata, sourceHint) => {
            const bytes = base64ToBytes(bytesBase64);
            const webpBase64 = await imageBlobToWebpBase64(new Blob([bytes]));
            return apiFetch('/api/save-image-bytes', {
                method: 'POST',
                body: JSON.stringify({ bytesBase64: webpBase64, imageType: type, metadata, sourceHint })
            });
        },
        deleteImage: (path) => apiFetch('/api/delete-image', { method: 'POST', body: JSON.stringify({ relativePath: path }) }),
        disposeReplacedImage: (path) => apiFetch('/api/dispose-replaced-image', { method: 'POST', body: JSON.stringify({ relativePath: path }) }),
        selectImage: openImagePicker,
        readSelectedImageBytes: async (path) => {
            const file = uploadFileFor(path);
            if (!file) throw new Error('Selected upload is no longer available.');
            return { base64: await readFileBase64(file), sourcePath: file.name || path };
        },
        readRemoteImageBytes: (url) => apiFetch('/api/read-remote-image-bytes', {
            method: 'POST',
            body: JSON.stringify({ url })
        }),
        getImagePreviewUrl: async (path) => {
            const file = uploadFileFor(path);
            if (file) return URL.createObjectURL(file);
            return `/api/images/${String(path || '').replace(/^images\//, '').replace(/^\/+/, '')}`;
        },
        getImagesBaseUrl: async () => '/api/images',
        getImageDataUrls: (paths) => apiFetch('/api/image-data-urls', { method: 'POST', body: JSON.stringify({ paths }) }),
        toAssetUrl: (path) => path,
        isDockerMode: () => true,
        backupStatus: () => apiFetch('/api/backup-status'),
        exportBackup: downloadBackupZip,
        importBackup: async (options) => {
            const local = await apiFetch('/api/local-backup-status');
            if (local && local.found) {
                const useLocal = window.confirm('A local automated backup was found. Import the latest local backup?\n\nChoose Cancel to import a ZIP file manually instead.');
                if (useLocal) {
                    return apiFetch('/api/import-local-backup', { method: 'POST', body: JSON.stringify({ options }) });
                }
            } else {
                const useManual = window.confirm('No backup file found locally. Want to import a ZIP file manually?');
                if (!useManual) return { success: false, canceled: true };
            }
            const file = await openBackupDirectoryPicker();
            if (!file) return { success: false, canceled: true };
            return apiFetch('/api/import-backup', {
                method: 'POST',
                body: JSON.stringify({
                    options,
                    filename: file.name,
                    zipBase64: await readFileBase64(file)
                })
            });
        },
        confirmDialog: async (options) => ({ success: true, confirmed: window.confirm(`${options?.message || 'Are you sure?'}${options?.detail ? `\n\n${options.detail}` : ''}`) }),
        focusWindow: async () => ({ success: true }),
        openExternalUrl: async (url) => {
            window.open(url, '_blank', 'noopener,noreferrer');
            return { success: true };
        },
        getAppInfo: () => apiFetch('/api/app-info'),
        getReleaseStatus: () => apiFetch('/api/release-status'),
        fetchInkSwatch: (query) => apiFetch('/api/fetch-inkswatch', { method: 'POST', body: JSON.stringify({ query }) }),
        saveImageUrl: (url, type, metadata) => apiFetch('/api/save-image-url', { method: 'POST', body: JSON.stringify({ url, imageType: type, metadata }) }),
        detectPenColors: async () => ({ success: false, message: 'Server-side color detection is unavailable in Docker mode.' })
    };
})();
