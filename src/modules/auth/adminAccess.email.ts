import nodemailer from 'nodemailer';

import {
  env,
} from '../../config/env.js';

import {
  AppError,
} from '../../utils/AppError.js';


type AdminAccessEmailInput = {
  correo: string;

  nombre: string;

  codigo: string;

  expiresInMinutes: number;
};


function escapeHtml(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


export async function sendAdminAccessCodeEmail(
  input:
    AdminAccessEmailInput
): Promise<void> {
  const smtpUser =
    String(
      env.smtp.user ||
      ''
    )
      .trim();

  const smtpPassword =
    String(
      env.smtp.password ||
      ''
    );

  if (
    !smtpUser ||
    !smtpPassword
  ) {
    throw new AppError(
      'Configuración SMTP no disponible',
      503
    );
  }

  const transporter =
    nodemailer.createTransport({
      host:
        env.smtp.host,

      port:
        Number(
          env.smtp.port
        ),

      secure:
        Number(
          env.smtp.port
        ) === 465,

      auth: {
        user:
          smtpUser,

        pass:
          smtpPassword,
      },
    });

  const correo =
    String(
      input.correo
    )
      .trim();

  const nombre =
    escapeHtml(
      input.nombre
    );

  const codigo =
    String(
      input.codigo
    )
      .trim();

  const minutos =
    Number(
      input.expiresInMinutes
    );

  const html = `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
        <tr>
          <td align="center">
            <table width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:28px 32px;background:#0f172a;">
                  <div style="font-size:27px;font-weight:800;color:#ffffff;">
                    SMART RH
                  </div>
                  <div style="margin-top:7px;font-size:13px;color:#cbd5e1;">
                    Autorización de acceso administrativo
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.6;">
                    Hola ${nombre}.
                  </p>

                  <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">
                    Se solicitó autorización para ingresar al área administrativa de SMART RH.
                  </p>

                  <div style="padding:22px;text-align:center;background:#f1f5f9;border-radius:16px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#64748b;">
                      CÓDIGO DE AUTORIZACIÓN
                    </div>

                    <div style="margin-top:10px;font-size:38px;font-weight:800;letter-spacing:8px;color:#0f172a;">
                      ${codigo}
                    </div>
                  </div>

                  <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
                    El código vence en ${minutos} minutos y solo puede utilizarse una vez.
                  </p>

                  <p style="margin:14px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
                    Si no solicitaste este acceso, no compartas el código y simplemente ignora este mensaje.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;">
                  SMART RH · Seguridad de acceso
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  const text = [
    'SMART RH',
    '',
    `Hola ${input.nombre}.`,
    '',
    'Se solicitó autorización para ingresar al área administrativa.',
    '',
    `Código: ${codigo}`,
    '',
    `Vence en ${minutos} minutos.`,
    '',
    'Si no solicitaste este acceso, ignora este mensaje.',
  ].join(
    '\n'
  );

  await transporter.sendMail({
    from:
      `"SMART RH Seguridad" <${smtpUser}>`,

    to:
      correo,

    subject:
      'SMART RH | Código de autorización administrativa',

    html,

    text,
  });
}
