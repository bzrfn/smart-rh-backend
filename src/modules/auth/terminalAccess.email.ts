import nodemailer from 'nodemailer';

import {
  env,
} from '../../config/env.js';

import {
  AppError,
} from '../../utils/AppError.js';


export type TerminalAccessApprovalEmailInput = {
  correo:
    string;

  terminalId:
    string;

  challengeId:
    string;

  expiresInMinutes:
    number;
};


function escapeHtml(
  value:
    unknown
): string {
  return String(
    value ??
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


export async function sendTerminalAccessApprovalEmail(
  input:
    TerminalAccessApprovalEmailInput
): Promise<void> {
  const smtpUser =
    String(
      env.smtp.user ||
      ''
    ).trim();

  const smtpPassword =
    String(
      env.smtp.password ||
      ''
    );

  const correo =
    String(
      input.correo ||
      ''
    ).trim();

  if (
    !smtpUser ||
    !smtpPassword
  ) {
    throw new AppError(
      'Configuración SMTP no disponible',
      503
    );
  }

  if (
    !correo ||
    !correo.includes(
      '@'
    )
  ) {
    throw new AppError(
      'Aprobador de terminal no configurado',
      503
    );
  }

  const terminalId =
    escapeHtml(
      input.terminalId
    );

  const challengeId =
    escapeHtml(
      input.challengeId
    );

  const expiresInMinutes =
    Number(
      input.expiresInMinutes
    );

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

  const portalOrigin =
    String(
      process.env.CORS_ORIGIN ||
      'https://portal.smart-rh.com.mx'
    )
      .split(',')[0]
      .trim()
      .replace(
        /\/+$/,
        ''
      );

  const approvalUrl =
    escapeHtml(
      `${portalOrigin}/portal/terminal-autorizacion?challengeId=${encodeURIComponent(
        input.challengeId
      )}`
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
                    Solicitud de autorización de terminal de asistencia
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.6;">
                    Una terminal solicitó autorización para operar el QR de asistencia.
                  </p>

                  <div style="padding:20px;background:#f1f5f9;border-radius:16px;">
                    <div style="font-size:13px;color:#64748b;">
                      Terminal
                    </div>

                    <div style="margin-top:5px;font-size:16px;font-weight:700;color:#0f172a;">
                      ${terminalId}
                    </div>

                    <div style="margin-top:18px;font-size:13px;color:#64748b;">
                      Solicitud
                    </div>

                    <div style="margin-top:5px;font-size:13px;font-family:monospace;color:#0f172a;word-break:break-all;">
                      ${challengeId}
                    </div>
                  </div>

                  <div style="margin:24px 0 4px;text-align:center;">
                    <a
                      href="${approvalUrl}"
                      style="display:inline-block;padding:14px 24px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;"
                    >
                      Revisar y autorizar terminal
                    </a>
                  </div>
                  <p style="margin:22px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
                    La solicitud vence en ${expiresInMinutes} minutos.
                    Revísala desde el portal administrativo autenticado de SMART RH.
                  </p>

                  <p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
                    Este mensaje no contiene credenciales de sesión de la terminal.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from:
      smtpUser,

    to:
      correo,

    subject:
      'SMART RH — Solicitud de autorización de terminal',

    html,
  });
}
