import nodemailer from 'nodemailer';

type ContactoPayload = {
  nombre: string;
  correo: string;
  empresa: string;
  mensaje: string;
};

function validarTexto(valor: unknown) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function limpiarTexto(valor: string) {
  return valor
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function enviarCorreoContactoService(data: ContactoPayload) {
  const { nombre, correo, empresa, mensaje } = data;

  if (
    !validarTexto(nombre) ||
    !validarTexto(correo) ||
    !validarTexto(empresa) ||
    !validarTexto(mensaje)
  ) {
    throw new Error('Todos los campos son obligatorios.');
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const contactTo = process.env.CONTACT_TO || smtpUser;

  if (!smtpUser || !smtpPass || !contactTo) {
    throw new Error('Configuración SMTP incompleta.');
  }

  const nombreSeguro = limpiarTexto(nombre);
  const correoSeguro = limpiarTexto(correo);
  const empresaSeguro = limpiarTexto(empresa);
  const mensajeSeguro = limpiarTexto(mensaje);

  const fechaEnvio = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const asunto = `SMART RH | Nueva solicitud de contacto - ${empresa.trim()}`;

  const html = `
    <div style="margin:0; padding:0; background:#eef4f8; font-family:Arial, Helvetica, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f8; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="720" cellpadding="0" cellspacing="0" style="max-width:720px; width:100%; background:#ffffff; border-radius:22px; overflow:hidden; border:1px solid #d9e6ef; box-shadow:0 18px 45px rgba(15, 23, 42, 0.10);">
              
              <tr>
                <td style="background:linear-gradient(135deg,#0a57a4,#22b8b0); padding:28px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="display:inline-block; width:58px; height:58px; line-height:58px; text-align:center; border-radius:18px; background:rgba(255,255,255,0.18); color:#ffffff; font-weight:800; font-size:16px; margin-bottom:16px;">
                          SRH
                        </div>

                        <h1 style="margin:0; color:#ffffff; font-size:30px; font-weight:800; letter-spacing:-0.5px;">
                          SMART RH
                        </h1>

                        <p style="margin:8px 0 0; color:#dff9ff; font-size:14px; font-weight:600;">
                          Suite empresarial de Recursos Humanos
                        </p>
                      </td>

                      <td align="right" style="vertical-align:top;">
                        <span style="display:inline-block; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,0.16); color:#ffffff; font-size:12px; font-weight:700; letter-spacing:0.8px;">
                          NUEVO CONTACTO
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px 32px 10px;">
                  <h2 style="margin:0; color:#0f172a; font-size:24px; font-weight:800;">
                    Solicitud recibida desde la página principal
                  </h2>

                  <p style="margin:10px 0 0; color:#64748b; font-size:15px; line-height:1.6;">
                    Una persona completó el formulario público de SMART RH. A continuación se muestran los datos proporcionados.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0 12px;">
                    <tr>
                      <td style="padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                        <p style="margin:0 0 6px; color:#0a57a4; font-size:12px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
                          Nombre completo
                        </p>

                        <p style="margin:0; color:#0f172a; font-size:16px; font-weight:700;">
                          ${nombreSeguro}
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                        <p style="margin:0 0 6px; color:#0a57a4; font-size:12px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
                          Correo electrónico
                        </p>

                        <p style="margin:0; color:#0f172a; font-size:16px; font-weight:700;">
                          <a href="mailto:${correoSeguro}" style="color:#0a57a4; text-decoration:none;">
                            ${correoSeguro}
                          </a>
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:16px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                        <p style="margin:0 0 6px; color:#0a57a4; font-size:12px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
                          Empresa
                        </p>

                        <p style="margin:0; color:#0f172a; font-size:16px; font-weight:700;">
                          ${empresaSeguro}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:4px 32px 28px;">
                  <div style="padding:22px; border-radius:18px; background:#ffffff; border:1px solid #dbeafe;">
                    <p style="margin:0 0 10px; color:#22b8b0; font-size:12px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
                      Mensaje
                    </p>

                    <p style="margin:0; color:#334155; font-size:15px; line-height:1.8;">
                      ${mensajeSeguro}
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:18px; border-radius:18px; background:#eff6ff; border:1px solid #bfdbfe;">
                        <p style="margin:0; color:#0f172a; font-size:14px; font-weight:700;">
                          Recomendación:
                        </p>

                        <p style="margin:6px 0 0; color:#475569; font-size:14px; line-height:1.6;">
                          Responde directamente a este correo para contactar al solicitante. El campo de respuesta fue configurado con su correo electrónico.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:18px; border-radius:18px; background:#f8fafc; border:1px solid #e2e8f0;">
                        <p style="margin:0 0 6px; color:#0a57a4; font-size:12px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase;">
                          Origen del mensaje
                        </p>

                        <p style="margin:0; color:#475569; font-size:14px; line-height:1.6;">
                          Formulario público de contacto · Landing Page SMART RH
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
                        <p style="margin:0; color:#ffffff; font-size:15px; font-weight:800;">
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

  const text = `
SMART RH - Nueva solicitud de contacto

Nombre: ${nombre.trim()}
Correo: ${correo.trim()}
Empresa: ${empresa.trim()}

Mensaje:
${mensaje.trim()}

Fecha de envío:
${fechaEnvio}
  `;

  await transporter.sendMail({
    from: `"SMART RH Contacto" <${smtpUser}>`,
    to: contactTo,
    replyTo: correo.trim(),
    subject: asunto,
    html,
    text,
  });

  return {
    ok: true,
    message: 'Mensaje enviado correctamente.',
  };
}