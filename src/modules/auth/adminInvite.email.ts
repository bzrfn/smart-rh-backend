import nodemailer from 'nodemailer';


export type AdminInvitationEmailInput = {
  correo: string;
  nombre: string;
  acceptUrl: string;
  expiresInMinutes: number;
};


export async function sendAdminInvitationEmail(
  input: AdminInvitationEmailInput
): Promise<void> {
  const smtpUser =
    String(
      process.env.SMTP_USER ||
      ''
    ).trim();

  const smtpPass =
    String(
      process.env.SMTP_PASS ||
      ''
    );

  if (
    !smtpUser ||
    !smtpPass
  ) {
    throw new Error(
      'Configuración SMTP incompleta.'
    );
  }

  const transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST ||
        'smtp.gmail.com',

      port:
        Number(
          process.env.SMTP_PORT ||
          587
        ),

      secure:
        false,

      auth: {
        user:
          smtpUser,

        pass:
          smtpPass,
      },
    });

  const nombre =
    String(
      input.nombre ||
      ''
    ).trim() ||
    'Administrador';

  const acceptUrl =
    String(
      input.acceptUrl ||
      ''
    ).trim();

  if (!acceptUrl) {
    throw new Error(
      'URL de invitación inválida'
    );
  }

  await transporter.sendMail({
    from:
      `"SMART RH Seguridad" <${smtpUser}>`,

    to:
      input.correo,

    subject:
      'Invitación administrativa - SMART RH',

    text:
      [
        `Hola ${nombre}.`,
        '',
        'Has sido invitado a crear una cuenta administrativa en SMART RH.',
        '',
        `La invitación vence en ${input.expiresInMinutes} minutos.`,
        '',
        `Abrir invitación: ${acceptUrl}`,
        '',
        'Tú establecerás tu propia contraseña durante la activación.',
        'Si no esperabas esta invitación, ignora este mensaje.',
      ].join(
        '\n'
      ),

    html:
      `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>SMART RH</h2>

          <p>
            Hola ${nombre}.
          </p>

          <p>
            Has sido invitado a crear una cuenta administrativa.
          </p>

          <p>
            Esta invitación vence en
            <strong>${input.expiresInMinutes} minutos</strong>.
          </p>

          <p>
            <a href="${acceptUrl}">
              Activar cuenta administrativa
            </a>
          </p>

          <p>
            Tú establecerás tu propia contraseña.
          </p>

          <p>
            Si no esperabas esta invitación, ignora este correo.
          </p>
        </div>
      `,
  });
}
