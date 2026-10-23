import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Employee invitation infrastructure', () => {
  const repository = readFileSync(
    resolve(process.cwd(), 'src/modules/auth/adminInvite.repository.ts'),
    'utf8'
  );
  const email = readFileSync(
    resolve(process.cwd(), 'src/modules/auth/adminInvite.email.ts'),
    'utf8'
  );
  const crypto = readFileSync(
    resolve(process.cwd(), 'src/modules/auth/adminInvite.crypto.ts'),
    'utf8'
  );

  test('liga criptograficamente el rol al enlace y crea la cuenta con ese rol', () => {
    expect(crypto).toContain("accountType: 'admin' | 'empleado'");
    expect(crypto).toContain("`${normalizedInvitationId}:${normalizedToken}:empleado`");
    expect(repository).toContain('normalizeInviteRole');
    expect(repository).toContain('inviteRoleInput');
  });

  test('el correo explica correctamente si la cuenta es de empleado o administrador', () => {
    expect(email).toContain("accountType?: 'admin' | 'empleado'");
    expect(email).toContain("'Invitación de empleado'");
    expect(email).toContain("'Aplicación SMART RH'");
  });
});
