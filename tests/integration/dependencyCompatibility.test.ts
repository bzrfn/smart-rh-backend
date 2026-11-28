import nodemailer from 'nodemailer';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';

describe('compatibilidad de dependencias de documentos y correo', () => {
  test('Nodemailer genera el mensaje MIME sin conexiones externas', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const result = await transport.sendMail({
      from: 'SMART RH <origen@example.invalid>',
      to: 'destino@example.invalid',
      subject: 'Invitacion SMART RH',
      text: 'Activa tu cuenta con el enlace de la invitacion.',
      html: '<p>Activa tu cuenta con el enlace de la invitacion.</p>',
    });
    const mime = result.message.toString();
    expect(mime).toContain('Subject: Invitacion SMART RH');
    expect(mime).toContain('Content-Type: multipart/alternative');
    expect(mime).toContain('destino@example.invalid');
  });

  test('Sharp convierte el SVG utilizado en documentos a un PNG legible', async () => {
    const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#005baa"/></svg>');
    const png = await sharp(source).png().toBuffer();
    const metadata = await sharp(png).metadata();
    expect(metadata).toMatchObject({ format: 'png', width: 16, height: 12 });
  });

  test('UUID conserva el formato de los identificadores de asistencia', () => {
    expect(`QR-${uuid()}`).toMatch(/^QR-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
});
