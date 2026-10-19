import fs from 'fs';
import path from 'path';
import { validateAccountDeletionPayload } from '../../src/modules/users/users.validation.js';

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('authenticated account deletion', () => {
  test('requires password and the explicit ELIMINAR confirmation', () => {
    expect(
      validateAccountDeletionPayload({
        password: 'Segura123',
        confirmation: 'ELIMINAR',
      })
    ).toEqual({
      password: 'Segura123',
      confirmation: 'ELIMINAR',
    });

    expect(() =>
      validateAccountDeletionPayload({
        password: 'Segura123',
        confirmation: 'eliminar',
      })
    ).toThrow('Escribe ELIMINAR');
  });

  test('exposes deletion to the authenticated account owner before admin id routes', () => {
    const routes = read('src/modules/users/users.routes.ts');
    expect(routes).toContain("userRoutes.delete('/me', authJwt, deleteOwnAccountController)");
    expect(routes.indexOf("delete('/me'")).toBeLessThan(routes.indexOf("delete('/:id'"));
  });

  test('removes owned files and anonymizes the active identity', () => {
    const cleanup = read('src/modules/users/users.account-deletion.ts');
    const repository = read('src/modules/users/users.repository.ts');

    expect(cleanup).toContain('deleteStorageObject');
    expect(cleanup).toContain('DocumentoGeneradoModel.deleteMany');
    expect(cleanup).toContain('SoporteTicketModel.deleteMany');
    expect(repository).toContain("apellido = 'eliminada'");
    expect(repository).toContain('session_version = COALESCE(session_version, 1) + 1');
    expect(repository).toContain('activo = 0');
  });
});
