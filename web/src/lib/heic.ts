/**
 * HEIC/HEIF photos (what iPhones save) are turned into JPEG in the browser
 * before upload, so the server needs no HEIC support. The browser's own
 * decoder is tried first (Safari has one); otherwise libheif, which is only
 * downloaded the first time a HEIC photo is chosen.
 */

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/** Whether a file is HEIC/HEIF: by type, by name, or by its first bytes (some systems give no type). */
export async function isHeic(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return isHeicBytes(head);
}

export function isHeicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const text = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4));
  if (text(4) !== 'ftyp') return false;
  for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
    if (HEIC_BRANDS.has(text(offset))) return true;
  }
  return false;
}

/** The photo as a JPEG file with the same name (ending in .jpg). */
export async function heicToJpeg(file: File): Promise<File> {
  const canvas = (await drawNatively(file)) ?? (await drawWithLibheif(file));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not convert the HEIC photo.');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function drawNatively(file: File): Promise<HTMLCanvasElement | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    return null;
  }
}

type HeifImage = {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, done: (result: ImageData | null) => void): void;
};
type Libheif = { HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] } };

let libheif: Promise<Libheif> | null = null;

async function drawWithLibheif(file: File): Promise<HTMLCanvasElement> {
  libheif ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then(
    (module) => Promise.resolve(module.default()) as Promise<Libheif>,
  );
  const decoder = new (await libheif).HeifDecoder();
  const [image] = decoder.decode(new Uint8Array(await file.arrayBuffer()));
  if (!image) throw new Error('This HEIC file holds no photo.');
  const width = image.get_width();
  const height = image.get_height();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not convert the HEIC photo.');
  const pixels = context.createImageData(width, height);
  await new Promise<void>((resolve, reject) =>
    image.display(pixels, (result) => (result ? resolve() : reject(new Error('Could not read the HEIC photo.')))),
  );
  context.putImageData(pixels, 0, 0);
  return canvas;
}
