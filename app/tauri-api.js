(function () {
  const tauri = window.__TAURI__;
  const invoke = tauri && tauri.core && typeof tauri.core.invoke === 'function'
    ? tauri.core.invoke
    : null;
  const Channel = tauri && tauri.core && typeof tauri.core.Channel === 'function'
    ? tauri.core.Channel
    : null;
  if (!invoke || window.inkubatorAPI) return;

  let dataRevision = null;
  let dataGeneration = 0;
  let dataWriteQueue = Promise.resolve();
  let dataConflictError = null;

  function createApiError(value, fallbackMessage = '') {
    if (value instanceof Error) return value;
    const payload = value && typeof value === 'object' ? value : null;
    const message = (payload && payload.message)
      || (typeof value === 'string' ? value : '')
      || fallbackMessage
      || 'Request failed.';
    const error = new Error(message);
    error.status = Number(payload && payload.status) || 0;
    error.code = payload && payload.code ? String(payload.code) : '';
    error.conflict = !!(payload && payload.conflict) || error.code === 'DATA_CONFLICT';
    error.revision = payload && payload.revision != null ? String(payload.revision) : null;
    error.payload = payload;
    if (error.conflict) error.name = 'DataConflictError';
    return error;
  }

  function isDataConflict(value) {
    return !!value && (
      value.conflict === true
      || value.code === 'DATA_CONFLICT'
    );
  }

  function rememberDataConflict(error) {
    if (isDataConflict(error)) dataConflictError = error;
    return error;
  }

  function snapshotReplacedError() {
    return createApiError({
      code: 'DATA_SNAPSHOT_REPLACED',
      message: 'The collection was reloaded before this queued save could run.'
    });
  }

  function captureRevision(payload, { replaceSnapshot = false } = {}) {
    const hasRevision = !!payload
      && typeof payload === 'object'
      && Object.prototype.hasOwnProperty.call(payload, 'revision');
    if (replaceSnapshot) {
      dataRevision = hasRevision && payload.revision != null ? String(payload.revision) : null;
      dataGeneration += 1;
      dataConflictError = null;
      return;
    }
    if (hasRevision && payload.revision != null) {
      dataRevision = String(payload.revision);
    }
  }

  function enqueueDataWrite(task) {
    const operation = dataWriteQueue.then(task, task);
    dataWriteQueue = operation.catch(() => {});
    return operation;
  }

  const call = async (command, payload) => {
    try {
      return await invoke(command, payload || {});
    } catch (error) {
      throw createApiError(error);
    }
  };

  async function loadData() {
    const payload = await call('load_data');
    if (
      payload
      && payload.success === true
      && Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      captureRevision(payload, { replaceSnapshot: true });
      return payload.data;
    }
    captureRevision(null, { replaceSnapshot: true });
    return payload;
  }

  function saveData(data) {
    let serializedData;
    try {
      serializedData = JSON.stringify(data);
    } catch (error) {
      return Promise.reject(error);
    }
    if (serializedData === undefined) {
      return Promise.reject(new Error('Data snapshot is not serializable.'));
    }
    const generation = dataGeneration;

    return enqueueDataWrite(async () => {
      if (generation !== dataGeneration) throw snapshotReplacedError();
      if (dataConflictError) throw dataConflictError;

      try {
        const result = await call('save_data', {
          data: JSON.parse(serializedData),
          expectedRevision: dataRevision
        });
        if (isDataConflict(result)) {
          throw createApiError(result);
        }
        if (result && result.success) captureRevision(result);
        return result;
      } catch (error) {
        throw rememberDataConflict(createApiError(error));
      }
    });
  }

  window.inkubatorAPI = {
    loadData,
    saveData,
    saveImage: (path, type, metadata) => call('save_image', { sourcePath: path, imageType: type, metadata }),
    saveImageBytes: (bytesBase64, type, metadata, sourceHint) => call('save_image_bytes', { bytesBase64, imageType: type, metadata, sourceHint }),
    deleteImage: (path) => call('delete_image', { relativePath: path }),
    disposeReplacedImage: (path) => call('dispose_replaced_image', { relativePath: path }),
    selectImage: () => call('select_image'),
    readSelectedImageBytes: (path) => call('read_selected_image_bytes', { sourcePath: path }),
    readRemoteImageBytes: (url) => call('read_remote_image_bytes', { url }),
    getImagePreviewUrl: (path) => call('get_image_preview_url', { sourcePath: path }),
    getImagesBaseUrl: () => call('get_images_base_url'),
    backupStatus: () => call('backup_status'),
    exportBackup: async (options = {}) => {
      const waitFor = options && options.waitFor && typeof options.waitFor.then === 'function'
        ? options.waitFor
        : null;
      if (waitFor) await waitFor;
      if (!Channel) {
        throw new Error('Desktop backup export progress support is unavailable.');
      }
      const onStarted = options && typeof options.onStarted === 'function'
        ? options.onStarted
        : null;
      const progressChannel = new Channel(() => {
        if (onStarted) onStarted();
      });
      return call('export_backup', { onStarted: progressChannel });
    },
    selectBackup: () => call('select_backup'),
    importBackup: (zipPath, options) => {
      const generation = dataGeneration;
      return enqueueDataWrite(async () => {
        if (generation !== dataGeneration) throw snapshotReplacedError();
        if (dataConflictError) throw dataConflictError;

        try {
          const result = await call('import_backup', {
            zipPath,
            options,
            expectedRevision: dataRevision
          });
          if (isDataConflict(result)) {
            throw createApiError(result);
          }
          if (result && result.success) {
            captureRevision(result, { replaceSnapshot: true });
          }
          return result;
        } catch (error) {
          throw rememberDataConflict(createApiError(error));
        }
      });
    },
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
