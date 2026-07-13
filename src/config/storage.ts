import fs from 'fs';
import path from 'path';

export const uploadRoot = path.resolve(process.cwd(), 'uploads');

export function ensureUploadStructure() {
  ['profiles', 'contratos', 'credenciales', 'documentos'].forEach((folder) => {
    fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
  });
}

export function publicUploadPath(relativePath: string) {
  return `/uploads/${relativePath.replace(/^\/+/, '')}`;
}
