import nodemailer from 'nodemailer';


export type AdminInvitationEmailInput = {
  correo: string;
  nombre: string;
  acceptUrl: string;
  expiresInMinutes: number;
};


function escapeHtml(
  value: unknown
): string {
  return String(
    value ??
    ''
  )
    .trim()
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}


function getTransporter(
  smtpUser: string,
  smtpPass: string
) {
  return nodemailer.createTransport({
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
}


function buildAdminInvitationHtml(
  input: {
    nombre: string;
    correo: string;
    acceptUrl: string;
    expiresInMinutes: number;
  }
): string {
  const safeNombre =
    escapeHtml(
      input.nombre
    );

  const safeCorreo =
    escapeHtml(
      input.correo
    );

  const safeAcceptUrl =
    escapeHtml(
      input.acceptUrl
    );

  const safeExpires =
    escapeHtml(
      input.expiresInMinutes
    );

  const fechaEnvio =
    new Date()
      .toLocaleString(
        'es-MX',
        {
          dateStyle:
            'full',

          timeStyle:
            'short',
        }
      );

  const safeFecha =
    escapeHtml(
      fechaEnvio
    );


  return `
    <!doctype html>

    <html lang="es">

      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>
          Invitación administrativa - SMART RH
        </title>
      </head>


      <body
        style="
          margin:0;
          padding:0;
          background:#eef4f8;
          font-family:Arial,Helvetica,sans-serif;
        "
      >

        <div
          style="
            display:none;
            max-height:0;
            overflow:hidden;
            opacity:0;
          "
        >
          Has recibido una invitación administrativa de SMART RH.
        </div>


        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            width:100%;
            background:#eef4f8;
            padding:32px 16px;
          "
        >

          <tr>

            <td align="center">

              <table
                role="presentation"
                width="720"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  max-width:720px;
                  background:#ffffff;
                  border-radius:22px;
                  overflow:hidden;
                  border:1px solid #d9e6ef;
                  box-shadow:0 18px 45px rgba(15,23,42,0.10);
                "
              >


                <!-- HEADER -->
                <tr>

                  <td
                    style="
                      padding:28px 32px;
                      background:linear-gradient(
                        135deg,
                        #0a57a4,
                        #22b8b0
                      );
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >

                      <tr>

                        <td>

                          <div
                            style="
                              display:inline-block;
                              width:58px;
                              height:58px;
                              line-height:58px;
                              text-align:center;
                              border-radius:18px;
                              background:rgba(255,255,255,0.18);
                              color:#ffffff;
                              font-size:16px;
                              font-weight:900;
                              margin-bottom:16px;
                            "
                          >
                            SRH
                          </div>


                          <h1
                            style="
                              margin:0;
                              color:#ffffff;
                              font-size:30px;
                              font-weight:900;
                              letter-spacing:-0.5px;
                            "
                          >
                            SMART RH
                          </h1>


                          <p
                            style="
                              margin:8px 0 0;
                              color:#dff9ff;
                              font-size:14px;
                              font-weight:600;
                            "
                          >
                            Suite empresarial de Recursos Humanos
                          </p>

                        </td>


                        <td
                          align="right"
                          style="
                            vertical-align:top;
                          "
                        >

                          <span
                            style="
                              display:inline-block;
                              padding:8px 14px;
                              border-radius:999px;
                              background:rgba(255,255,255,0.16);
                              color:#ffffff;
                              font-size:12px;
                              font-weight:800;
                              letter-spacing:0.8px;
                            "
                          >
                            INVITACIÓN ADMIN
                          </span>

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>


                <!-- INTRO -->
                <tr>

                  <td
                    style="
                      padding:30px 32px 14px;
                    "
                  >

                    <h2
                      style="
                        margin:0;
                        color:#0f172a;
                        font-size:24px;
                        font-weight:900;
                      "
                    >
                      Activa tu cuenta administrativa
                    </h2>


                    <p
                      style="
                        margin:10px 0 0;
                        color:#64748b;
                        font-size:15px;
                        line-height:1.7;
                      "
                    >
                      Hola
                      <strong
                        style="
                          color:#0f172a;
                        "
                      >
                        ${safeNombre}
                      </strong>.
                      Has sido invitado(a) a crear una cuenta
                      administrativa dentro de SMART RH.
                    </p>

                  </td>

                </tr>


                <!-- ACTION CARD -->
                <tr>

                  <td
                    style="
                      padding:12px 32px 24px;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        background:linear-gradient(
                          135deg,
                          #eff6ff,
                          #ecfeff
                        );
                        border:1px solid #bfdbfe;
                        border-radius:20px;
                      "
                    >

                      <tr>

                        <td
                          align="center"
                          style="
                            padding:28px 24px;
                          "
                        >

                          <p
                            style="
                              margin:0 0 8px;
                              color:#0a57a4;
                              font-size:12px;
                              font-weight:800;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Acción requerida
                          </p>


                          <p
                            style="
                              margin:0 0 20px;
                              color:#475569;
                              font-size:14px;
                              line-height:1.7;
                            "
                          >
                            Define tu propia contraseña para completar
                            la creación de tu cuenta.
                          </p>


                          <table
                            role="presentation"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >

                            <tr>

                              <td
                                align="center"
                                bgcolor="#0a57a4"
                                style="
                                  border-radius:14px;
                                "
                              >

                                <a
                                  href="${safeAcceptUrl}"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style="
                                    display:inline-block;
                                    padding:15px 26px;
                                    border-radius:14px;
                                    background:#0a57a4;
                                    color:#ffffff;
                                    text-decoration:none;
                                    font-size:15px;
                                    font-weight:900;
                                  "
                                >
                                  Activar cuenta administrativa
                                </a>

                              </td>

                            </tr>

                          </table>


                          <p
                            style="
                              margin:18px 0 0;
                              color:#64748b;
                              font-size:13px;
                              line-height:1.6;
                            "
                          >
                            Este enlace es personal y de un solo uso.
                          </p>

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>


                <!-- DETAILS -->
                <tr>

                  <td
                    style="
                      padding:0 32px 26px;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        border-collapse:separate;
                        border-spacing:0 10px;
                      "
                    >


                      <tr>

                        <td
                          style="
                            padding:14px 16px;
                            background:#f8fafc;
                            border:1px solid #e2e8f0;
                            border-radius:14px;
                          "
                        >

                          <p
                            style="
                              margin:0 0 5px;
                              color:#0a57a4;
                              font-size:11px;
                              font-weight:800;
                              letter-spacing:0.8px;
                              text-transform:uppercase;
                            "
                          >
                            Usuario invitado
                          </p>

                          <p
                            style="
                              margin:0;
                              color:#0f172a;
                              font-size:15px;
                              font-weight:700;
                              line-height:1.5;
                            "
                          >
                            ${safeNombre}
                          </p>

                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            padding:14px 16px;
                            background:#f8fafc;
                            border:1px solid #e2e8f0;
                            border-radius:14px;
                          "
                        >

                          <p
                            style="
                              margin:0 0 5px;
                              color:#0a57a4;
                              font-size:11px;
                              font-weight:800;
                              letter-spacing:0.8px;
                              text-transform:uppercase;
                            "
                          >
                            Correo
                          </p>

                          <p
                            style="
                              margin:0;
                              color:#0f172a;
                              font-size:15px;
                              font-weight:700;
                              line-height:1.5;
                            "
                          >
                            ${safeCorreo}
                          </p>

                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            padding:14px 16px;
                            background:#f8fafc;
                            border:1px solid #e2e8f0;
                            border-radius:14px;
                          "
                        >

                          <p
                            style="
                              margin:0 0 5px;
                              color:#0a57a4;
                              font-size:11px;
                              font-weight:800;
                              letter-spacing:0.8px;
                              text-transform:uppercase;
                            "
                          >
                            Vigencia
                          </p>

                          <p
                            style="
                              margin:0;
                              color:#0f172a;
                              font-size:15px;
                              font-weight:700;
                              line-height:1.5;
                            "
                          >
                            ${safeExpires} minutos
                          </p>

                        </td>

                      </tr>


                      <tr>

                        <td
                          style="
                            padding:14px 16px;
                            background:#f8fafc;
                            border:1px solid #e2e8f0;
                            border-radius:14px;
                          "
                        >

                          <p
                            style="
                              margin:0 0 5px;
                              color:#0a57a4;
                              font-size:11px;
                              font-weight:800;
                              letter-spacing:0.8px;
                              text-transform:uppercase;
                            "
                          >
                            Tipo de acceso
                          </p>

                          <p
                            style="
                              margin:0;
                              color:#0f172a;
                              font-size:15px;
                              font-weight:700;
                              line-height:1.5;
                            "
                          >
                            Portal administrativo
                          </p>

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>


                <!-- SECURITY -->
                <tr>

                  <td
                    style="
                      padding:0 32px 30px;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >

                      <tr>

                        <td
                          style="
                            padding:18px;
                            border-radius:18px;
                            background:#eff6ff;
                            border:1px solid #bfdbfe;
                          "
                        >

                          <p
                            style="
                              margin:0;
                              color:#0f172a;
                              font-size:14px;
                              font-weight:800;
                            "
                          >
                            Aviso de seguridad
                          </p>


                          <p
                            style="
                              margin:6px 0 0;
                              color:#475569;
                              font-size:14px;
                              line-height:1.6;
                            "
                          >
                            Esta invitación es de un solo uso y vence
                            en ${safeExpires} minutos. No compartas el
                            enlace de activación. Si no esperabas esta
                            invitación, puedes ignorar este mensaje.
                          </p>

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>


                <!-- FOOTER -->
                <tr>

                  <td
                    style="
                      padding:22px 32px;
                      background:#0f172a;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >

                      <tr>

                        <td>

                          <p
                            style="
                              margin:0;
                              color:#ffffff;
                              font-size:15px;
                              font-weight:900;
                            "
                          >
                            SMART RH
                          </p>

                          <p
                            style="
                              margin:6px 0 0;
                              color:#94a3b8;
                              font-size:13px;
                            "
                          >
                            Gestión moderna de Recursos Humanos
                          </p>

                        </td>


                        <td
                          align="right"
                        >

                          <p
                            style="
                              margin:0;
                              color:#94a3b8;
                              font-size:12px;
                            "
                          >
                            ${safeFecha}
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

      </body>

    </html>
  `;
}


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


  const nombre =
    String(
      input.nombre ||
      ''
    ).trim() ||
    'Administrador';

  const correo =
    String(
      input.correo ||
      ''
    ).trim();

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


  const transporter =
    getTransporter(
      smtpUser,
      smtpPass
    );


  await transporter.sendMail({
    from:
      `"SMART RH Seguridad" <${smtpUser}>`,

    to:
      correo,

    subject:
      'Invitación administrativa - SMART RH',

    text:
      [
        'SMART RH - Invitación administrativa',
        '',
        `Hola ${nombre}.`,
        '',
        'Has sido invitado(a) a crear una cuenta administrativa en SMART RH.',
        '',
        `La invitación vence en ${input.expiresInMinutes} minutos.`,
        '',
        `Abrir invitación: ${acceptUrl}`,
        '',
        'Tú establecerás tu propia contraseña durante la activación.',
        '',
        'Esta invitación es personal y de un solo uso.',
        '',
        'Si no esperabas esta invitación, ignora este mensaje.',
      ].join(
        '\n'
      ),

    html:
      buildAdminInvitationHtml({
        nombre,
        correo,
        acceptUrl,
        expiresInMinutes:
          input.expiresInMinutes,
      }),
  });
}
