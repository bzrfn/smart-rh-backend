import fs from 'node:fs';

describe('QR dinámico con vigencia de 20 segundos', () => {
  const envSource = fs.readFileSync('src/config/env.ts', 'utf8');
  const serviceSource = fs.readFileSync(
    'src/modules/asistencia/asistencia.service.ts',
    'utf8'
  );

  test('usa 20 segundos como valor predeterminado', () => {
    expect(envSource).toMatch(/validitySeconds:\s*20/);
    expect(envSource).not.toMatch(
      /validitySeconds:[\s\S]{0,120}process\.env\.QR_VALIDITY_SECONDS/
    );
  });

  test('calcula la expiración desde la configuración central', () => {
    expect(serviceSource).toContain('env.qr.validitySeconds');
    expect(serviceSource).toContain('20 segundos');
  });
});
