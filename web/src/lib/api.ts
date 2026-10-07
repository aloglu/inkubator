/**
 * Talks to inkubator-server. Every change to the collection goes through
 * `runCommand`, which sends the revision it was based on; the server refuses it
 * with a conflict if the collection changed in the meantime.
 */
import type { BackupFile } from './types/BackupFile';
import type { BackupSettings } from './types/BackupSettings';
import type { Collection } from './types/Collection';
import type { Command } from './types/Command';
import type { PublicCollection } from './types/PublicCollection';

export type Loaded = { collection: Collection; revision: string };
export type PhotoSection = 'pens' | 'inks' | 'swatches';

/** An error reported by the server, with its machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isConflict() {
    return this.code === 'conflict';
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  /** Validation problems listed by the server for `invalid` errors. */
  get problems(): string[] {
    const problems = this.body.problems;
    return Array.isArray(problems) ? problems.map(String) : [];
  }
}

/** Called whenever the server says the session has expired. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'offline', 'Could not reach the server. Check your connection.');
  }
  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await response.json();
    } catch {
      /* not JSON */
    }
    const error = new ApiError(
      response.status,
      typeof body.code === 'string' ? body.code : 'error',
      typeof body.message === 'string' ? body.message : `Request failed (${response.status}).`,
      body,
    );
    if (error.isUnauthorized && !path.startsWith('/auth/')) onUnauthorized();
    throw error;
  }
  return (await response.json()) as T;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ---------- session ----------

export async function getSession(): Promise<boolean> {
  const { signed_in } = await request<{ signed_in: boolean }>('/auth/session');
  return signed_in;
}

export async function login(username: string, password: string): Promise<void> {
  await request('/auth/login', json('POST', { username, password }));
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function getAppInfo(): Promise<{ version: string }> {
  return request('/api/app-info');
}

// ---------- collection ----------

export async function getCollection(): Promise<Loaded> {
  return request('/api/collection');
}

export type CommandResult = Loaded & { retired_photos: string[] };

export async function runCommand(command: Command, revision: string): Promise<CommandResult> {
  return request('/api/commands', json('POST', { command, revision }));
}

// ---------- photos ----------

/** Uploads a photo; the server converts it and returns its stored path. */
export async function uploadPhoto(section: PhotoSection, file: Blob, name = ''): Promise<string> {
  const query = new URLSearchParams({ name });
  const { path } = await request<{ path: string }>(`/api/uploads/${section}?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  return path;
}

export async function photoFromUrl(section: PhotoSection, url: string, name = ''): Promise<string> {
  const { path } = await request<{ path: string }>(
    `/api/uploads/${section}/from-url`,
    json('POST', { url, name }),
  );
  return path;
}

export async function findInkswatch(query: string): Promise<{ image_url: string; ink_name: string }> {
  return request(`/api/inkswatch?${new URLSearchParams({ query })}`);
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** URL of a stored photo, for the admin views. */
export function photoUrl(path: string, thumb = false): string {
  return `/api/${thumb ? 'thumbs' : 'photos'}/${encodePath(path)}`;
}

/** URL of a photo on the public showcase. */
export function publicPhotoUrl(path: string, thumb = false): string {
  return `/public/${thumb ? 'thumbs' : 'photos'}/${encodePath(path)}`;
}

// ---------- backups ----------

export async function listBackups(): Promise<{ scheduled: BackupFile[]; settings: BackupSettings }> {
  return request('/api/backups');
}

/** Download link for a full backup (zip). */
export const exportUrl = '/api/backups/export';

/** Replaces the collection with a backup. The server keeps a safety backup first. */
export async function restoreBackup(file: Blob, revision: string): Promise<Loaded> {
  return request(`/api/backups/restore?${new URLSearchParams({ revision })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: file,
  });
}

// ---------- showcase ----------

export async function getPublic(): Promise<PublicCollection> {
  return request('/api/public');
}
