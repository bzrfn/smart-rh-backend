import PDFDocument from 'pdfkit';

// ============================================================
// IDENTIDAD VISUAL SMART RH
// ============================================================

const PRIMARY = '#073B5A';
const PRIMARY_DARK = '#052B43';
const ACCENT = '#0AA6A6';
const ACCENT_LIGHT = '#E5F8F6';

const TEXT = '#263B4A';
const MUTED = '#64748B';

const BORDER = '#DCE6ED';
const BACKGROUND = '#F4F8FB';
const WHITE = '#FFFFFF';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 50;

// ============================================================
// HELPERS GENERALES
// ============================================================

function safeText(
  value: unknown,
  fallback = 'No registrado'
): string {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return fallback;
  }

  return String(value).trim();
}

function escapeXml(value: unknown): string {
  return safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function limitText(
  value: unknown,
  max: number
): string {
  const text = safeText(value);

  return text.length > max
    ? `${text.slice(0, max - 3)}...`
    : text;
}

function capitalize(value: unknown): string {
  const text = safeText(value);

  if (!text) return '';

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1).toLowerCase()
  );
}

function employeeCode(id: number): string {
  return `EMP-${String(id).padStart(3, '0')}`;
}

function formatCredentialDate(
  value?: string | Date | null
): string {
  if (!value) return 'Indefinido';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return safeText(value);
  }

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================================
// CREDENCIAL
// ============================================================

export type CredentialDesignData = {
  width?: number;
  height?: number;

  employeeId: number;

  nombreCompleto: string;
  rol: string;
  correo: string;

  fechaInicioContrato?: string | Date | null;
  fechaFinContrato?: string | Date | null;
  vigencia?: string | Date | null;

  logoBase64?: string;
  qrBase64: string;

  profileImage?: {
    mime: string;
    base64: string;
  } | null;
};

export function buildCredentialSvg(
  data: CredentialDesignData
): string {
  const width = data.width || 720;
  const height = data.height || 1280;

  const nombre =
    escapeXml(
      limitText(
        data.nombreCompleto.toUpperCase(),
        31
      )
    );

  const rol =
    escapeXml(
      capitalize(data.rol)
    );

  const correo =
    escapeXml(
      limitText(
        data.correo,
        42
      )
    );

  const idEmpleado =
    escapeXml(
      employeeCode(
        data.employeeId
      )
    );

  const inicio =
    formatCredentialDate(
      data.fechaInicioContrato
    );

  const fin =
    data.fechaFinContrato
      ? formatCredentialDate(
          data.fechaFinContrato
        )
      : 'Indefinido';

  const periodo =
    escapeXml(
      `${inicio} al ${fin}`
    );

  const vigencia =
    escapeXml(
      `Hasta el ${formatCredentialDate(
        data.vigencia
      )}`
    );

  const initial =
    escapeXml(
      data.nombreCompleto
        .slice(0, 1)
        .toUpperCase()
    );

  const logoContent =
    data.logoBase64
      ? `
        <rect
          x="130"
          y="54"
          width="460"
          height="130"
          rx="20"
          fill="#ffffff"
          opacity="0.97"
        />

        <image
          href="data:image/jpeg;base64,${data.logoBase64}"
          x="150"
          y="76"
          width="420"
          height="86"
          preserveAspectRatio="xMidYMid meet"
        />
      `
      : `
        <text
          x="360"
          y="125"
          text-anchor="middle"
          font-size="50"
          font-weight="800"
          fill="#ffffff"
        >
          SMART RH
        </text>
      `;

  const avatarContent =
    data.profileImage
      ? `
        <image
          href="data:${data.profileImage.mime};base64,${data.profileImage.base64}"
          x="254"
          y="205"
          width="212"
          height="212"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `
      : `
        <text
          x="360"
          y="338"
          text-anchor="middle"
          font-size="78"
          font-weight="800"
          fill="${PRIMARY}"
        >
          ${initial}
        </text>
      `;

  return `
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
      font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
    >
      <defs>
        <linearGradient
          id="headerBg"
          x1="0"
          x2="1"
          y1="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="${PRIMARY_DARK}"
          />

          <stop
            offset="55%"
            stop-color="#057D8C"
          />

          <stop
            offset="100%"
            stop-color="#0FB3A8"
          />
        </linearGradient>

        <filter
          id="shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="10"
            flood-color="#0B2F45"
            flood-opacity="0.16"
          />
        </filter>

        <clipPath id="avatarClip">
          <circle
            cx="360"
            cy="311"
            r="106"
          />
        </clipPath>
      </defs>

      <!-- FONDO -->
      <rect
        width="720"
        height="1280"
        rx="46"
        fill="${BACKGROUND}"
      />

      <!-- ENCABEZADO -->
      <rect
        x="0"
        y="0"
        width="720"
        height="285"
        rx="46"
        fill="url(#headerBg)"
      />

      <rect
        x="0"
        y="240"
        width="720"
        height="80"
        fill="${BACKGROUND}"
      />

      ${logoContent}

      <!-- FOTO -->
      <circle
        cx="360"
        cy="311"
        r="117"
        fill="${WHITE}"
        stroke="${ACCENT}"
        stroke-width="8"
        filter="url(#shadow)"
      />

      ${avatarContent}

      <!-- NOMBRE -->
      <text
        x="360"
        y="490"
        text-anchor="middle"
        font-size="36"
        font-weight="800"
        fill="${PRIMARY}"
      >
        ${nombre}
      </text>

      <!-- ROL -->
      <text
        x="360"
        y="535"
        text-anchor="middle"
        font-size="24"
        font-weight="700"
        fill="${ACCENT}"
      >
        ${rol}
      </text>

      <!-- TARJETA INFORMACIÓN -->
      <rect
        x="60"
        y="575"
        width="600"
        height="390"
        rx="30"
        fill="${WHITE}"
        stroke="${BORDER}"
        stroke-width="1"
        filter="url(#shadow)"
      />

      <!-- TÍTULO -->
      <text
        x="100"
        y="620"
        font-size="17"
        font-weight="800"
        letter-spacing="1.5"
        fill="${ACCENT}"
      >
        INFORMACIÓN LABORAL
      </text>

      <line
        x1="100"
        y1="642"
        x2="620"
        y2="642"
        stroke="${BORDER}"
        stroke-width="1"
      />

      <!-- ================================================== -->
      <!-- FILA 1: ID DE EMPLEADO / ROL                     -->
      <!-- ================================================== -->

      <!-- ID -->
      <text
        x="100"
        y="680"
        font-size="15"
        font-weight="800"
        letter-spacing="1"
        fill="${MUTED}"
      >
        ID DE EMPLEADO
      </text>

      <text
        x="100"
        y="713"
        font-size="24"
        font-weight="800"
        fill="${PRIMARY}"
      >
        ${idEmpleado}
      </text>

      <!-- ROL -->
      <text
        x="390"
        y="680"
        font-size="15"
        font-weight="800"
        letter-spacing="1"
        fill="${MUTED}"
      >
        ROL
      </text>

      <text
        x="390"
        y="713"
        font-size="24"
        font-weight="700"
        fill="${TEXT}"
      >
        ${rol}
      </text>

      <!-- ================================================== -->
      <!-- FILA 2: CORREO                                    -->
      <!-- ================================================== -->

      <text
        x="100"
        y="760"
        font-size="15"
        font-weight="800"
        letter-spacing="1"
        fill="${MUTED}"
      >
        CORREO ELECTRÓNICO
      </text>

      <text
        x="100"
        y="793"
        font-size="21"
        font-weight="500"
        fill="${TEXT}"
      >
        ${correo}
      </text>

      <!-- ================================================== -->
      <!-- FILA 3: PERIODO CONTRACTUAL                       -->
      <!-- ================================================== -->

      <text
        x="100"
        y="840"
        font-size="15"
        font-weight="800"
        letter-spacing="1"
        fill="${MUTED}"
      >
        PERIODO CONTRACTUAL
      </text>

      <text
        x="100"
        y="873"
        font-size="21"
        font-weight="700"
        fill="${PRIMARY}"
      >
        ${periodo}
      </text>

      <!-- ================================================== -->
      <!-- FILA 4: VIGENCIA                                  -->
      <!-- ================================================== -->

      <text
        x="100"
        y="910"
        font-size="15"
        font-weight="800"
        letter-spacing="1"
        fill="${MUTED}"
      >
        VIGENCIA DE LA CREDENCIAL
      </text>

      <text
        x="100"
        y="943"
        font-size="20"
        font-weight="700"
        fill="${PRIMARY}"
      >
        ${vigencia}
      </text>

      <!-- ================================================== -->
      <!-- QR                                                 -->
      <!-- ================================================== -->

      <rect
        x="260"
        y="990"
        width="200"
        height="200"
        rx="26"
        fill="${WHITE}"
        stroke="${BORDER}"
        stroke-width="1"
        filter="url(#shadow)"
      />

      <image
        href="data:image/png;base64,${data.qrBase64}"
        x="275"
        y="1005"
        width="170"
        height="170"
      />

      <text
        x="360"
        y="1210"
        text-anchor="middle"
        font-size="15"
        font-weight="600"
        fill="${MUTED}"
      >
        Código QR de identificación
      </text>

      <!-- PIE -->
      <rect
        x="76"
        y="1220"
        width="568"
        height="45"
        rx="17"
        fill="${PRIMARY}"
      />

      <text
        x="360"
        y="1249"
        text-anchor="middle"
        font-size="17"
        font-weight="800"
        letter-spacing="0.5"
        fill="${WHITE}"
      >
        CREDENCIAL INSTITUCIONAL SMART RH
      </text>
    </svg>
  `;
}

// ============================================================
// CONTRATO PROFESIONAL
// ============================================================

export type ContractDesignData = {
  folio: string;

  logoBuffer?: Buffer | null;

  empleado: {
    id: number;
    nombreCompleto: string;
    correo: string;
    telefono: string;
    direccion: string;
    puesto: string;
    fechaIngreso: string;
  };

  contrato: {
    tipo: string;
    salario: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    vacaciones: string;
  };
};

// ============================================================
// PDF -> BUFFER
// ============================================================

export function buildContractPdfBuffer(
  data: ContractDesignData
): Promise<Buffer> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const doc =
        new PDFDocument({
          size: 'LETTER',
          margin: MARGIN_X,
          autoFirstPage: false,
          bufferPages: false,
          info: {
            Title:
              `Contrato laboral - ${safeText(
                data.empleado.nombreCompleto
              )}`,
            Author: 'SMART RH',
            Subject:
              'Documento contractual laboral',
            Creator: 'SMART RH',
          },
        });

      const chunks: Buffer[] = [];

      doc.on(
        'data',
        (chunk) => {
          chunks.push(
            Buffer.from(chunk)
          );
        }
      );

      doc.on(
        'end',
        () => {
          resolve(
            Buffer.concat(chunks)
          );
        }
      );

      doc.on(
        'error',
        reject
      );

      // ======================================================
      // PÁGINA 1
      // ======================================================

      doc.addPage({
        size: 'LETTER',
        margin: MARGIN_X,
      });

      drawContractHeader(
        doc,
        data,
        'CONTRATO LABORAL',
        'Resumen e información contractual'
      );

      drawContractSectionTitle(
        doc,
        'INFORMACIÓN DEL EMPLEADO',
        145
      );

      drawContractInfoCard(
        doc,
        175,
        [
          [
            'ID de empleado',
            employeeCode(
              data.empleado.id
            ),
          ],
          [
            'Nombre completo',
            safeText(
              data.empleado.nombreCompleto
            ),
          ],
          [
            'Correo electrónico',
            safeText(
              data.empleado.correo
            ),
          ],
          [
            'Teléfono',
            safeText(
              data.empleado.telefono
            ),
          ],
          [
            'Puesto / rol',
            capitalize(
              data.empleado.puesto
            ),
          ],
          [
            'Fecha de ingreso',
            safeText(
              data.empleado.fechaIngreso
            ),
          ],
          [
            'Dirección',
            safeText(
              data.empleado.direccion
            ),
          ],
        ]
      );

      drawContractSectionTitle(
        doc,
        'CONDICIONES REGISTRADAS',
        395
      );

      drawContractInfoCard(
        doc,
        425,
        [
          [
            'Tipo de contrato',
            capitalize(
              data.contrato.tipo
            ),
          ],
          [
            'Salario base mensual',
            `$${safeText(
              data.contrato.salario
            )}`,
          ],
          [
            'Fecha de inicio',
            safeText(
              data.contrato.fechaInicio
            ),
          ],
          [
            'Fecha de terminación',
            safeText(
              data.contrato.fechaFin
            ),
          ],
          [
            'Estado contractual',
            capitalize(
              data.contrato.estado
            ),
          ],
          [
            'Vacaciones',
            safeText(
              data.contrato.vacaciones
            ),
          ],
        ]
      );

      drawDocumentNotice(
        doc,
        620,
        'Este documento concentra la información contractual registrada en SMART RH. ' +
          'Su contenido debe ser revisado y validado por el área de Recursos Humanos antes de su formalización.'
      );

      drawContractFooter(
        doc,
        1,
        3,
        data.folio
      );

      // ======================================================
      // PÁGINA 2
      // ======================================================

      doc.addPage({
        size: 'LETTER',
        margin: MARGIN_X,
      });

      drawContractHeader(
        doc,
        data,
        'CONDICIONES CONTRACTUALES',
        'Términos generales registrados'
      );

      drawContractSectionTitle(
        doc,
        'CLÁUSULAS GENERALES',
        145
      );

      const clauses = [
        {
          title:
            'PRIMERA. Objeto de la relación laboral',
          body:
            `El empleado desempeñará las funciones correspondientes al puesto de ${safeText(
              data.empleado.puesto
            )}, así como las actividades relacionadas razonablemente con dicho puesto que sean asignadas dentro de la organización.`,
        },

        {
          title:
            'SEGUNDA. Vigencia contractual',
          body:
            `La relación registrada inicia el ${safeText(
              data.contrato.fechaInicio
            )} y tiene como fecha de terminación ${safeText(
              data.contrato.fechaFin
            )}. Cualquier prórroga, renovación o modificación deberá quedar documentada en el expediente laboral.`,
        },

        {
          title:
            'TERCERA. Remuneración',
          body:
            `El salario base mensual registrado es de $${safeText(
              data.contrato.salario
            )}. Los pagos, deducciones, bonos, prestaciones y demás conceptos aplicables deberán reflejarse en los registros de nómina correspondientes.`,
        },

        {
          title:
            'CUARTA. Jornada, horarios y descansos',
          body:
            'La jornada, los horarios, periodos de descanso y modalidad de prestación de servicios se sujetarán a las condiciones acordadas por las partes y a las políticas laborales aplicables. Cuando estos elementos no estén expresamente indicados en este documento, deberán constar en el expediente o instrumento complementario correspondiente.',
        },

        {
          title:
            'QUINTA. Vacaciones y descansos',
          body:
            `El registro actual de vacaciones asociado al contrato corresponde a: ${safeText(
              data.contrato.vacaciones
            )}. Su disfrute, programación y autorización deberán gestionarse conforme a las políticas internas y disposiciones laborales aplicables.`,
        },

        {
          title:
            'SEXTA. Obligaciones del empleado',
          body:
            'El empleado se compromete a desempeñar sus funciones con responsabilidad, diligencia, respeto y confidencialidad; cumplir las políticas internas; utilizar adecuadamente los recursos asignados y atender las medidas de seguridad aplicables a sus actividades.',
        },

        {
          title:
            'SÉPTIMA. Confidencialidad',
          body:
            'La información administrativa, técnica, operativa, financiera, comercial o personal a la que el empleado tenga acceso deberá ser tratada de manera confidencial y utilizada exclusivamente para los fines autorizados dentro de sus funciones.',
        },

        {
          title:
            'OCTAVA. Protección de información y datos',
          body:
            'Los datos personales y documentos laborales vinculados con esta relación deberán ser tratados y resguardados conforme a los controles de acceso, seguridad y conservación definidos por la organización y por la normativa aplicable.',
        },

        {
          title:
            'NOVENA. Modificaciones y terminación',
          body:
            'Toda modificación relevante de las condiciones registradas deberá documentarse formalmente y conservar trazabilidad. La terminación de la relación laboral deberá atender las condiciones pactadas, la documentación correspondiente y las disposiciones laborales aplicables.',
        },

        {
          title:
            'DÉCIMA. Control documental',
          body:
            'El presente archivo es generado por SMART RH a partir de la información registrada en el expediente del empleado. La formalización contractual requiere la revisión, aceptación y firma de las partes correspondientes.',
        },
      ];

      let clauseY = 176;

      for (
        const clause of clauses
      ) {
        clauseY =
          drawContractClause(
            doc,
            clauseY,
            clause.title,
            clause.body
          );
      }

      drawContractFooter(
        doc,
        2,
        3,
        data.folio
      );

      // ======================================================
      // PÁGINA 3
      // ======================================================

      doc.addPage({
        size: 'LETTER',
        margin: MARGIN_X,
      });

      drawContractHeader(
        doc,
        data,
        'ACEPTACIÓN Y FIRMAS',
        'Validación y control documental'
      );

      drawContractSectionTitle(
        doc,
        'RESUMEN DE ACEPTACIÓN',
        145
      );

      doc
        .fillColor(TEXT)
        .font('Helvetica')
        .fontSize(10.2)
        .text(
          'Las partes manifiestan que la información contenida en este documento corresponde a las condiciones registradas en el expediente laboral y que, previa revisión, podrá formalizarse mediante las firmas correspondientes.',
          MARGIN_X,
          180,
          {
            width: 512,
            align: 'justify',
            lineGap: 3,
          }
        );

      drawAcceptanceSummary(
        doc,
        data,
        250
      );

      drawSignature(
        doc,
        70,
        485,
        'EMPLEADO',
        safeText(
          data.empleado.nombreCompleto
        )
      );

      drawSignature(
        doc,
        352,
        485,
        'RECURSOS HUMANOS',
        'Representante autorizado'
      );

      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          `Fecha de emisión: ${new Date().toLocaleDateString(
            'es-MX',
            {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }
          )}`,
          MARGIN_X,
          575,
          {
            width: 512,
            align: 'center',
          }
        );

      drawDocumentNotice(
        doc,
        620,
        'SMART RH conserva trazabilidad documental de la generación del archivo. ' +
          'La autenticidad administrativa del documento deberá verificarse contra el expediente laboral correspondiente.'
      );

      drawContractFooter(
        doc,
        3,
        3,
        data.folio
      );

      doc.end();
    }
  );
}

// ============================================================
// PDF - HEADER
// ============================================================

function drawContractHeader(
  doc: PDFKit.PDFDocument,
  data: ContractDesignData,
  title: string,
  subtitle: string
) {
  doc
    .rect(
      0,
      0,
      PAGE_WIDTH,
      115
    )
    .fill(PRIMARY);

  doc
    .rect(
      0,
      108,
      PAGE_WIDTH,
      7
    )
    .fill(ACCENT);

  if (data.logoBuffer) {
    doc
      .roundedRect(
        48,
        22,
        170,
        65,
        10
      )
      .fill(WHITE);

    doc.image(
      data.logoBuffer,
      62,
      32,
      {
        fit: [
          142,
          44,
        ],
        align: 'center',
        valign: 'center',
      }
    );
  } else {
    doc
      .fillColor(WHITE)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(
        'SMART RH',
        50,
        35,
        {
          width: 170,
        }
      );
  }

  doc
    .fillColor(WHITE)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(
      title,
      245,
      27,
      {
        width: 315,
        align: 'right',
      }
    );

  doc
    .fillColor('#DDF8F5')
    .font('Helvetica')
    .fontSize(9)
    .text(
      subtitle,
      245,
      53,
      {
        width: 315,
        align: 'right',
      }
    );

  doc
    .fillColor('#BCEDEA')
    .font('Helvetica')
    .fontSize(7.8)
    .text(
      `Folio: ${safeText(
        data.folio
      )}`,
      245,
      78,
      {
        width: 315,
        align: 'right',
      }
    );
}

// ============================================================
// PDF - SECCIONES
// ============================================================

function drawContractSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number
) {
  doc
    .fillColor(PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      title,
      MARGIN_X,
      y
    );

  doc
    .roundedRect(
      MARGIN_X,
      y + 21,
      48,
      3,
      1
    )
    .fill(ACCENT);
}

// ============================================================
// PDF - INFORMACIÓN
// ============================================================

function drawContractInfoCard(
  doc: PDFKit.PDFDocument,
  y: number,
  rows: Array<
    [
      string,
      string
    ]
  >
) {
  const rowHeight = 25;
  const height =
    rows.length *
      rowHeight +
    24;

  doc
    .roundedRect(
      MARGIN_X,
      y,
      512,
      height,
      12
    )
    .fillAndStroke(
      WHITE,
      BORDER
    );

  let currentY =
    y + 14;

  rows.forEach(
    (
      [
        label,
        value,
      ],
      index
    ) => {
      if (
        index > 0
      ) {
        doc
          .strokeColor(
            '#EEF3F6'
          )
          .lineWidth(
            0.7
          )
          .moveTo(
            MARGIN_X + 16,
            currentY - 6
          )
          .lineTo(
            MARGIN_X + 496,
            currentY - 6
          )
          .stroke();
      }

      doc
        .fillColor(
          PRIMARY
        )
        .font(
          'Helvetica-Bold'
        )
        .fontSize(
          8.6
        )
        .text(
          label,
          MARGIN_X + 18,
          currentY,
          {
            width: 165,
            lineBreak: false,
          }
        );

      doc
        .fillColor(
          TEXT
        )
        .font(
          'Helvetica'
        )
        .fontSize(
          8.8
        )
        .text(
          safeText(
            value
          ),
          MARGIN_X + 195,
          currentY,
          {
            width: 290,
            lineBreak: false,
            ellipsis: true,
          }
        );

      currentY +=
        rowHeight;
    }
  );

  return (
    y + height
  );
}

// ============================================================
// PDF - CLÁUSULAS
// ============================================================

function drawContractClause(
  doc: PDFKit.PDFDocument,
  y: number,
  title: string,
  body: string
): number {
  // Título de cláusula
  doc
    .fillColor(
      PRIMARY
    )
    .font(
      'Helvetica-Bold'
    )
    .fontSize(
      9.3
    )
    .text(
      title,
      MARGIN_X,
      y,
      {
        width: 512,
        lineGap: 0,
      }
    );

  // Separación corta para conservar
  // las diez cláusulas en una sola página.
  const bodyY =
    doc.y + 3;

  // Contenido
  doc
    .fillColor(
      TEXT
    )
    .font(
      'Helvetica'
    )
    .fontSize(
      8.9
    )
    .text(
      body,
      MARGIN_X,
      bodyY,
      {
        width: 512,
        align: 'justify',
        lineGap: 0.8,
      }
    );

  // Separación uniforme entre cláusulas.
  return (
    doc.y + 8
  );
}


// ============================================================
// PDF - RESUMEN ACEPTACIÓN
// ============================================================

function drawAcceptanceSummary(
  doc: PDFKit.PDFDocument,
  data: ContractDesignData,
  y: number
) {
  doc
    .roundedRect(
      MARGIN_X,
      y,
      512,
      155,
      14
    )
    .fillAndStroke(
      '#F8FBFD',
      BORDER
    );

  const rows = [
    [
      'Empleado',
      safeText(
        data.empleado.nombreCompleto
      ),
    ],
    [
      'ID de empleado',
      employeeCode(
        data.empleado.id
      ),
    ],
    [
      'Tipo de contrato',
      capitalize(
        data.contrato.tipo
      ),
    ],
    [
      'Periodo',
      `${safeText(
        data.contrato.fechaInicio
      )} — ${safeText(
        data.contrato.fechaFin
      )}`,
    ],
    [
      'Estado',
      capitalize(
        data.contrato.estado
      ),
    ],
  ];

  let currentY =
    y + 17;

  for (
    const [
      label,
      value,
    ] of rows
  ) {
    doc
      .fillColor(
        MUTED
      )
      .font(
        'Helvetica-Bold'
      )
      .fontSize(
        8
      )
      .text(
        label,
        MARGIN_X + 18,
        currentY,
        {
          width: 145,
        }
      );

    doc
      .fillColor(
        TEXT
      )
      .font(
        'Helvetica'
      )
      .fontSize(
        8.8
      )
      .text(
        value,
        MARGIN_X + 175,
        currentY,
        {
          width: 310,
        }
      );

    currentY += 25;
  }
}

// ============================================================
// PDF - FIRMAS
// ============================================================

function drawSignature(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  title: string,
  name: string
) {
  doc
    .strokeColor(
      PRIMARY
    )
    .lineWidth(
      1
    )
    .moveTo(
      x,
      y
    )
    .lineTo(
      x + 190,
      y
    )
    .stroke();

  doc
    .fillColor(
      PRIMARY
    )
    .font(
      'Helvetica-Bold'
    )
    .fontSize(
      9.5
    )
    .text(
      title,
      x,
      y + 14,
      {
        width: 190,
        align: 'center',
      }
    );

  doc
    .fillColor(
      TEXT
    )
    .font(
      'Helvetica'
    )
    .fontSize(
      8.5
    )
    .text(
      name,
      x,
      y + 31,
      {
        width: 190,
        align: 'center',
      }
    );
}

// ============================================================
// PDF - AVISO
// ============================================================

function drawDocumentNotice(
  doc: PDFKit.PDFDocument,
  y: number,
  text: string
) {
  doc
    .roundedRect(
      MARGIN_X,
      y,
      512,
      55,
      10
    )
    .fill(
      ACCENT_LIGHT
    );

  doc
    .fillColor(
      PRIMARY
    )
    .font(
      'Helvetica'
    )
    .fontSize(
      8
    )
    .text(
      text,
      MARGIN_X + 16,
      y + 12,
      {
        width: 480,
        align: 'justify',
        lineGap: 1,
      }
    );
}

// ============================================================
// PDF - FOOTER
// ============================================================

function drawContractFooter(
  doc: PDFKit.PDFDocument,
  page: number,
  totalPages: number,
  folio: string
) {
  const y = 718;

  doc
    .strokeColor(
      '#E5EDF3'
    )
    .lineWidth(
      1
    )
    .moveTo(
      MARGIN_X,
      y
    )
    .lineTo(
      PAGE_WIDTH -
        MARGIN_X,
      y
    )
    .stroke();

  doc
    .fillColor(
      MUTED
    )
    .font(
      'Helvetica'
    )
    .fontSize(
      6.8
    )
    .text(
      `SMART RH · Folio ${safeText(
        folio
      )}`,
      MARGIN_X,
      y + 10,
      {
        width: 315,
      }
    );

  doc
    .text(
      `Página ${page} de ${totalPages}`,
      455,
      y + 10,
      {
        width: 105,
        align: 'right',
      }
    );
}
