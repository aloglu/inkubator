(function () {
  const tauri = window.__TAURI__;
  const invoke = tauri && tauri.core && typeof tauri.core.invoke === 'function'
    ? tauri.core.invoke
    : null;
  const convertFileSrc = tauri && tauri.core && typeof tauri.core.convertFileSrc === 'function'
    ? tauri.core.convertFileSrc
    : null;

  if (!invoke || window.inkubatorAPI) return;

  const call = (command, payload) => invoke(command, payload || {});

  window.inkubatorAPI = {
    loadData: () => call('load_data'),
    saveData: (data) => call('save_data', { data }),
    saveImage: (path, type, metadata) => call('save_image', { sourcePath: path, imageType: type, metadata }),
    saveImageBytes: (bytesBase64, type, metadata, sourceHint) => call('save_image_bytes', { bytesBase64, imageType: type, metadata, sourceHint }),
    deleteImage: (path) => call('delete_image', { relativePath: path }),
    disposeReplacedImage: (path) => call('dispose_replaced_image', { relativePath: path }),
    selectImage: () => call('select_image'),
    readSelectedImageBytes: (path) => call('read_selected_image_bytes', { sourcePath: path }),
    readRemoteImageBytes: (url) => call('read_remote_image_bytes', { url }),
    getImagePreviewUrl: (path) => call('get_image_preview_url', { sourcePath: path }),
    getImagesBaseUrl: () => call('get_images_base_url'),
    getImageDataUrls: (paths) => call('get_image_data_urls', { paths }),
    toAssetUrl: (path) => convertFileSrc ? convertFileSrc(path) : path,
    backupStatus: () => call('backup_status'),
    exportBackup: () => call('export_backup'),
    importBackup: (options) => call('import_backup', { options }),
    exportShowcase: () => call('export_showcase'),
    confirmDialog: (options) => call('confirm_dialog', { options }),
    focusWindow: () => call('focus_window'),
    openExternalUrl: (url) => call('open_external_url', { url }),
    getAppInfo: () => call('get_app_info'),
    getReleaseStatus: () => call('get_release_status'),
    fetchInkSwatch: (query) => call('fetch_inkswatch', { query }),
    saveImageUrl: (url, type, metadata) => call('save_image_url', { url, imageType: type, metadata }),
    detectPenColors: (path) => call('detect_pen_colors', { sourcePath: path })
  };

})();
