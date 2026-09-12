import fs from 'fs';
import path from 'path';

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { env } from './env.js';

export const uploadRoot = path.resolve(process.cwd(), 'uploads');

export type StorageDriver = 'local' | 's3';

export type StoredObject = {
  body: Buffer;
  contentType: string;
};

let s3Client: S3Client | null = null;


// ============================================================
// DRIVER
// ============================================================

export function getStorageDriver(): StorageDriver {
  return env.storage.driver;
}

export function isS3Storage(): boolean {
  return getStorageDriver() === 's3';
}


// ============================================================
// S3 CLIENT
// ============================================================

function getS3Client(): S3Client {
  if (!env.storage.bucket) {
    throw new Error(
      'S3_DOCUMENTS_BUCKET no está configurado.'
    );
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: env.storage.region,
    });
  }

  return s3Client;
}


// ============================================================
// NORMALIZAR KEY
// ============================================================

export function normalizeStorageKey(value: string): string {
  const clean = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  const parts = clean
    .split('/')
    .filter(Boolean);

  if (
    parts.length === 0 ||
    parts.some((part) => part === '.' || part === '..')
  ) {
    throw new Error('Ruta de almacenamiento inválida.');
  }

  return parts.join('/');
}


// ============================================================
// ESTRUCTURA LOCAL
// ============================================================

export function ensureUploadStructure(): void {
  if (isS3Storage()) {
    return;
  }

  const folders = [
    'profiles',
    'contratos',
    'credenciales',
    'documentos',
    'etl',
    'empresa',
  ];

  for (const folder of folders) {
    fs.mkdirSync(
      path.join(uploadRoot, folder),
      {
        recursive: true,
      }
    );
  }
}


// ============================================================
// RUTA LOCAL SEGURA
// ============================================================

export function localStoragePath(
  relativePath: string
): string {
  const key = normalizeStorageKey(relativePath);

  const fullPath = path.resolve(
    uploadRoot,
    ...key.split('/')
  );

  const rootPrefix = `${uploadRoot}${path.sep}`;

  if (
    fullPath !== uploadRoot &&
    !fullPath.startsWith(rootPrefix)
  ) {
    throw new Error('Ruta fuera del directorio uploads.');
  }

  return fullPath;
}


// ============================================================
// URL COMPATIBLE CON SMART RH
//
// Seguimos almacenando:
//
// /uploads/profiles/...
// /uploads/contratos/...
// /uploads/credenciales/...
//
// independientemente de que internamente sea local o S3.
// ============================================================

export function publicUploadPath(
  relativePath: string
): string {
  const key = normalizeStorageKey(relativePath);

  return `/uploads/${key}`;
}


// ============================================================
// EXTRAER KEY DESDE URL
// ============================================================

export function storageKeyFromPublicPath(
  fileUrl?: string | null
): string | null {
  if (!fileUrl) {
    return null;
  }

  const cleanUrl = String(fileUrl)
    .split('?')[0]
    .split('#')[0];

  const uploadIndex = cleanUrl.indexOf('/uploads/');

  if (uploadIndex === -1) {
    return null;
  }

  const relativePath = cleanUrl.slice(
    uploadIndex + '/uploads/'.length
  );

  if (!relativePath) {
    return null;
  }

  try {
    return normalizeStorageKey(
      decodeURIComponent(relativePath)
    );
  } catch {
    return null;
  }
}


// ============================================================
// CONTENT TYPE
// ============================================================

export function getStorageContentType(
  key: string
): string {
  const extension = path
    .extname(key)
    .toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';

    case '.png':
      return 'image/png';

    case '.webp':
      return 'image/webp';

    case '.gif':
      return 'image/gif';

    case '.svg':
      return 'image/svg+xml';

    case '.pdf':
      return 'application/pdf';

    case '.csv':
      return 'text/csv; charset=utf-8';

    case '.json':
      return 'application/json; charset=utf-8';

    case '.txt':
      return 'text/plain; charset=utf-8';

    default:
      return 'application/octet-stream';
  }
}


// ============================================================
// BODY AWS -> BUFFER
// ============================================================

async function streamToBuffer(
  body: any
): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of body) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}


// ============================================================
// GUARDAR ARCHIVO
// ============================================================

export async function writeStorageObject(
  relativePath: string,
  data: Buffer | Uint8Array | string,
  contentType?: string
): Promise<string> {
  const key = normalizeStorageKey(relativePath);

  const body =
    typeof data === 'string'
      ? Buffer.from(data)
      : Buffer.from(data);

  const finalContentType =
    contentType || getStorageContentType(key);


  // ----------------------------------------------------------
  // LOCAL
  // ----------------------------------------------------------

  if (!isS3Storage()) {
    const filePath = localStoragePath(key);

    await fs.promises.mkdir(
      path.dirname(filePath),
      {
        recursive: true,
      }
    );

    await fs.promises.writeFile(
      filePath,
      body
    );

    return publicUploadPath(key);
  }


  // ----------------------------------------------------------
  // S3
  // ----------------------------------------------------------

  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: body,
      ContentType: finalContentType,
      ServerSideEncryption: 'AES256',
    })
  );

  return publicUploadPath(key);
}


// ============================================================
// LEER ARCHIVO
// ============================================================

export async function readStorageObject(
  relativePath: string
): Promise<StoredObject | null> {
  const key = normalizeStorageKey(relativePath);


  // ----------------------------------------------------------
  // LOCAL
  // ----------------------------------------------------------

  if (!isS3Storage()) {
    const filePath = localStoragePath(key);

    try {
      const body = await fs.promises.readFile(
        filePath
      );

      return {
        body,
        contentType:
          getStorageContentType(key),
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }


  // ----------------------------------------------------------
  // S3
  // ----------------------------------------------------------

  try {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
      })
    );

    return {
      body: await streamToBuffer(
        response.Body
      ),

      contentType:
        response.ContentType ||
        getStorageContentType(key),
    };
  } catch (error: any) {
    if (
      error?.name === 'NoSuchKey' ||
      error?.name === 'NotFound' ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      return null;
    }

    throw error;
  }
}


// ============================================================
// EXISTE
// ============================================================

export async function storageObjectExists(
  relativePath: string
): Promise<boolean> {
  const object =
    await readStorageObject(relativePath);

  return object !== null;
}


// ============================================================
// LISTAR ARCHIVOS
// ============================================================

export async function listStorageObjects(
  prefix = ''
): Promise<string[]> {
  const normalizedPrefix = prefix
    ? `${normalizeStorageKey(prefix).replace(/\/+$/, '')}/`
    : '';


  // ----------------------------------------------------------
  // LOCAL
  // ----------------------------------------------------------

  if (!isS3Storage()) {
    const directory = normalizedPrefix
      ? localStoragePath(
          normalizedPrefix.slice(0, -1)
        )
      : uploadRoot;

    try {
      const entries =
        await fs.promises.readdir(
          directory,
          {
            withFileTypes: true,
          }
        );

      return entries
        .filter((entry) => entry.isFile())
        .map((entry) =>
          normalizedPrefix
            ? `${normalizedPrefix}${entry.name}`
            : entry.name
        );
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }


  // ----------------------------------------------------------
  // S3
  // ----------------------------------------------------------

  const results: string[] = [];

  let continuationToken:
    | string
    | undefined;


  do {
    const response =
      await getS3Client().send(
        new ListObjectsV2Command({
          Bucket: env.storage.bucket,
          Prefix:
            normalizedPrefix ||
            undefined,
          ContinuationToken:
            continuationToken,
        })
      );

    for (
      const object of response.Contents || []
    ) {
      if (object.Key) {
        results.push(object.Key);
      }
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;

  } while (continuationToken);


  return results;
}