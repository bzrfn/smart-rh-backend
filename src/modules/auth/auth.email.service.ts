import nodemailer from 'nodemailer';

type EmailDetail = {
  label: string;
  value: string;
};

type SmartRhEmailPayload = {
  to: string;
  subject: string;
  badge: string;
  title: string;
  intro: string;
  code?: string;
  details?: EmailDetail[];
  footerNote?: string;
};

function escapeHtml(value: string) {
  return String(value || '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('Configuración SMTP incompleta.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function buildEmailHtml(payload: SmartRhEmailPayload) {
  const fechaEnvio = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const safeBadge = escapeHtml(payload.badge);
  const safeTitle = escapeHtml(payload.title);
  const safeIntro = escapeHtml(payload.intro);
  const safeFooterNote = escapeHtml(payload.footerNote || 'Este mensaje fue generado automáticamente por SMART RH.');

  const detailsHtml = (payload.details || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
            <p style="margin:0 0 5px; color:#0a57a4; font-size:11px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
              ${escapeHtml(item.label)}
            </p>
            <p style="margin:0; color:#0f172a; font-size:15px; font-weight:700; line-height:1.5;">
              ${escapeHtml(item.value)}
            </p>
          </td>
        </tr>
      `
    )
    .join('');

  const codeHtml = payload.code
    ? `
      <tr>
        <td style="padding:8px 32px 26px;">
          <div style="text-align:center; padding:26px 20px; border-radius:20px; background:linear-gradient(135deg,#eff6ff,#ecfeff); border:1px solid #bfdbfe;">
            <p style="margin:0 0 12px; color:#0a57a4; font-size:12px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
              Código de verificación
            </p>
            <div style="display:inline-block; padding:16px 28px; border-radius:18px; background:#0f172a; color:#ffffff; font-size:34px; font-weight:900; letter-spacing:8px;">
              ${escapeHtml(payload.code)}
            </div>
            <p style="margin:14px 0 0; color:#64748b; font-size:13px; line-height:1.6;">
              Este código es de un solo uso y vence en 10 minutos.
            </p>
          </div>
        </td>
      </tr>
    `
    : '';

  return `
    <div style="margin:0; padding:0; background:#eef4f8; font-family:Arial, Helvetica, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f8; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="720" cellpadding="0" cellspacing="0" style="max-width:720px; width:100%; background:#ffffff; border-radius:22px; overflow:hidden; border:1px solid #d9e6ef; box-shadow:0 18px 45px rgba(15,23,42,0.10);">
              
              <tr>
                <td style="background:linear-gradient(135deg,#0a57a4,#22b8b0); padding:28px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="display:inline-block; width:58px; height:58px; line-height:58px; text-align:center; border-radius:18px; background:rgba(255,255,255,0.18); color:#ffffff; font-weight:900; font-size:16px; margin-bottom:16px;">
                          SRH
                        </div>
                        <h1 style="margin:0; color:#ffffff; font-size:30px; font-weight:900; letter-spacing:-0.5px;">
                          SMART RH
                        </h1>
                        <p style="margin:8px 0 0; color:#dff9ff; font-size:14px; font-weight:600;">
                          Suite empresarial de Recursos Humanos
                        </p>
                      </td>

                      <td align="right" style="vertical-align:top;">
                        <span style="display:inline-block; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,0.16); color:#ffffff; font-size:12px; font-weight:800; letter-spacing:0.8px;">
                          ${safeBadge}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px 32px 14px;">
                  <h2 style="margin:0; color:#0f172a; font-size:24px; font-weight:900;">
                    ${safeTitle}
                  </h2>
                  <p style="margin:10px 0 0; color:#64748b; font-size:15px; line-height:1.7;">
                    ${safeIntro}
                  </p>
                </td>
              </tr>

              ${codeHtml}

              ${
                detailsHtml
                  ? `
                    <tr>
                      <td style="padding:0 32px 26px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0 10px;">
                          ${detailsHtml}
                        </table>
                      </td>
                    </tr>
                  `
                  : ''
              }

              <tr>
                <td style="padding:0 32px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:18px; border-radius:18px; background:#eff6ff; border:1px solid #bfdbfe;">
                        <p style="margin:0; color:#0f172a; font-size:14px; font-weight:800;">
                          Aviso de seguridad
                        </p>
                        <p style="margin:6px 0 0; color:#475569; font-size:14px; line-height:1.6;">
                          ${safeFooterNote}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="background:#0f172a; padding:22px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0; color:#ffffff; font-size:15px; font-weight:900;">
                          SMART RH
                        </p>
                        <p style="margin:6px 0 0; color:#94a3b8; font-size:13px;">
                          Gestión moderna de Recursos Humanos
                        </p>
                      </td>

                      <td align="right">
                        <p style="margin:0; color:#94a3b8; font-size:12px;">
                          ${fechaEnvio}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendSmartRhEmail(payload: SmartRhEmailPayload) {
  const smtpUser = process.env.SMTP_USER;

  if (!smtpUser) {
    throw new Error('Configuración SMTP incompleta.');
  }

  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"SMART RH Seguridad" <${smtpUser}>`,
    to: payload.to,
    subject: payload.subject,
    html: buildEmailHtml(payload),
  });
}

export async function enviarCodigoConfirmacionCuentaEmail(data: {
  correo: string;
  nombre: string;
  codigo: string;
}) {
  await sendSmartRhEmail({
    to: data.correo,
    subject: `SMART RH | Código de confirmación de cuenta`,
    badge: 'CONFIRMACIÓN',
    title: `Confirma tu cuenta, ${data.nombre}`,
    intro:
      'Gracias por registrarte en SMART RH. Ingresa el siguiente código en la aplicación para activar tu cuenta.',
    code: data.codigo,
    details: [
      { label: 'Correo registrado', value: data.correo },
      { label: 'Proceso', value: 'Confirmación de cuenta nueva' },
    ],
    footerNote:
      'Si tú no solicitaste este registro, puedes ignorar este correo. No compartas este código con nadie.',
  });
}

export async function enviarCuentaConfirmadaEmail(data: {
  correo: string;
  nombre: string;
}) {
  await sendSmartRhEmail({
    to: data.correo,
    subject: `SMART RH | Cuenta creada correctamente`,
    badge: 'CUENTA ACTIVA',
    title: `Tu cuenta ha sido confirmada`,
    intro:
      'Tu cuenta de SMART RH fue verificada correctamente. Ya puedes iniciar sesión y utilizar los servicios disponibles.',
    details: [
      { label: 'Usuario', value: data.nombre },
      { label: 'Correo', value: data.correo },
      { label: 'Estado', value: 'Cuenta activa y verificada' },
    ],
    footerNote:
      'Este correo confirma que tu cuenta fue activada correctamente dentro de SMART RH.',
  });
}

export async function enviarCodigoLoginEmail(data: {
  correo: string;
  nombre: string;
  codigo: string;
}) {
  await sendSmartRhEmail({
    to: data.correo,
    subject: `SMART RH | Código de acceso seguro`,
    badge: 'ACCESO 2FA',
    title: `Código de acceso a SMART RH`,
    intro:
      'Detectamos un intento de inicio de sesión. Ingresa este código en la aplicación para completar el acceso.',
    code: data.codigo,
    details: [
      { label: 'Usuario', value: data.nombre },
      { label: 'Correo', value: data.correo },
      { label: 'Proceso', value: 'Verificación de inicio de sesión' },
    ],
    footerNote:
      'Si no intentaste iniciar sesión, cambia tu contraseña o contacta al administrador de SMART RH.',
  });
}

export async function enviarCodigoResetPasswordEmail(data: {
  correo: string;
  nombre: string;
  codigo: string;
}) {
  await sendSmartRhEmail({
    to: data.correo,
    subject: `SMART RH | Código para restablecer contraseña`,
    badge: 'RECUPERACIÓN',
    title: `Restablecimiento de contraseña`,
    intro:
      'Recibimos una solicitud para restablecer tu contraseña. Usa este código en la aplicación para continuar.',
    code: data.codigo,
    details: [
      { label: 'Usuario', value: data.nombre },
      { label: 'Correo', value: data.correo },
      { label: 'Vigencia', value: '15 minutos' },
    ],
    footerNote:
      'Si no solicitaste restablecer tu contraseña, ignora este correo. Tu cuenta seguirá protegida.',
  });
}

export async function enviarPasswordActualizadoEmail(data: {
  correo: string;
  nombre: string;
}) {
  await sendSmartRhEmail({
    to: data.correo,
    subject: `SMART RH | Contraseña actualizada`,
    badge: 'SEGURIDAD',
    title: `Tu contraseña fue actualizada`,
    intro:
      'La contraseña de tu cuenta fue actualizada correctamente. Si tú no realizaste este cambio, contacta al administrador.',
    details: [
      { label: 'Usuario', value: data.nombre },
      { label: 'Correo', value: data.correo },
      { label: 'Estado', value: 'Contraseña actualizada correctamente' },
    ],
    footerNote:
      'Por seguridad, mantén tus credenciales privadas y no compartas códigos de acceso.',
  });
}

export async function enviarAlertaMonitoreoEmail(data: {
  correo: string;
  alarma: string;
  estado: string;
  motivo: string;
  fecha: string;
  region?: string;
  recurso?: string;
}) {
  const estado =
    String(
      data.estado || 'NOTIFICACION'
    )
      .trim()
      .toUpperCase();

  const badge =
    estado === 'ALARM'
      ? 'ALERTA AWS'
      : estado === 'OK'
        ? 'SERVICIO RECUPERADO'
        : 'MONITOREO AWS';

  const details: EmailDetail[] = [
    {
      label: 'Alarma',
      value: data.alarma,
    },
    {
      label: 'Estado',
      value: estado,
    },
    {
      label: 'Fecha',
      value: data.fecha,
    },
  ];

  if (data.region) {
    details.push({
      label: 'Región',
      value: data.region,
    });
  }

  if (data.recurso) {
    details.push({
      label: 'Recurso',
      value: data.recurso,
    });
  }

  details.push({
    label: 'Motivo',
    value: data.motivo,
  });

  await sendSmartRhEmail({
    to: data.correo,
    subject:
      `SMART RH | Monitoreo ${estado}: ${data.alarma}`,
    badge,
    title:
      estado === 'OK'
        ? `Servicio recuperado: ${data.alarma}`
        : `Alerta de infraestructura: ${data.alarma}`,
    intro:
      estado === 'OK'
        ? 'CloudWatch informó que el recurso volvió a su estado normal.'
        : 'CloudWatch detectó un evento que requiere atención operativa.',
    details,
    footerNote:
      'Mensaje automático del monitoreo de infraestructura de SMART RH. No respondas a este correo.',
  });
}
