import PDFDocument from 'pdfkit';

import {
  writeStorageObject,
} from '../config/storage.js';


type ContractData = {
  filename: string;

  logoBuffer?: Buffer | null;

  folio: string;

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


const PAGE_WIDTH = 612;

const MARGIN_X = 50;

const PRIMARY = '#073b5a';

const ACCENT = '#0aa6a6';

const LIGHT_BORDER = '#dbe7ee';

const TEXT = '#263b4a';

const MUTED = '#5f6b76';


// ============================================================
// TEXTO SEGURO
// ============================================================

function safe(
  value?: string | number | null
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'No registrado';
  }

  return String(value);
}


// ============================================================
// PDF DOCUMENT -> BUFFER
// ============================================================

async function documentToBuffer(
  doc: PDFKit.PDFDocument
): Promise<Buffer> {
  return await new Promise<Buffer>(
    (resolve, reject) => {
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk)
        );
      });

      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', reject);

      doc.end();
    }
  );
}


// ============================================================
// CONTRATO PROFESIONAL
// ============================================================

export async function generarContratoProfesionalPdf(
  data: ContractData
): Promise<string> {
  const safeName = data.filename.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 50,
    autoFirstPage: false,
    bufferPages: false,
  });


  // ----------------------------------------------------------
  // PÁGINA 1
  // ----------------------------------------------------------

  doc.addPage({
    size: 'LETTER',
    margin: 50,
  });

  drawHeader(doc, data);

  let y = 145;

  drawSectionTitle(
    doc,
    'DATOS DEL EMPLEADO',
    MARGIN_X,
    y
  );

  y = drawInfoBox(
    doc,
    MARGIN_X,
    y + 30,
    512,
    [
      [
        'ID empleado',
        `#${data.empleado.id}`,
      ],

      [
        'Nombre completo',
        data.empleado.nombreCompleto,
      ],

      [
        'Correo electrónico',
        data.empleado.correo,
      ],

      [
        'Teléfono',
        data.empleado.telefono,
      ],

      [
        'Dirección',
        data.empleado.direccion,
      ],

      [
        'Puesto / Rol',
        data.empleado.puesto,
      ],

      [
        'Fecha de ingreso',
        data.empleado.fechaIngreso,
      ],
    ]
  );


  drawSectionTitle(
    doc,
    'DATOS DEL CONTRATO',
    MARGIN_X,
    y + 22
  );


  drawInfoBox(
    doc,
    MARGIN_X,
    y + 52,
    512,
    [
      [
        'Tipo de contrato',
        data.contrato.tipo,
      ],

      [
        'Salario base mensual',
        `$${data.contrato.salario}`,
      ],

      [
        'Fecha de inicio',
        data.contrato.fechaInicio,
      ],

      [
        'Fecha de finalización',
        data.contrato.fechaFin,
      ],

      [
        'Estado',
        data.contrato.estado,
      ],

      [
        'Vacaciones por derecho',
        data.contrato.vacaciones,
      ],
    ]
  );


  drawFooter(
    doc,
    1,
    3
  );


  // ----------------------------------------------------------
  // PÁGINA 2
  // ----------------------------------------------------------

  doc.addPage({
    size: 'LETTER',
    margin: 50,
  });


  drawCompactPageHeader(
    doc,
    data,
    'CLÁUSULAS GENERALES'
  );


  drawClauses(
    doc,
    [
      'PRIMERA. El colaborador se obliga a prestar sus servicios de forma profesional, responsable y ética, cumpliendo con las actividades asignadas por la empresa.',

      'SEGUNDA. La empresa se compromete a respetar las condiciones laborales establecidas, incluyendo salario, jornada, descansos y prestaciones aplicables.',

      'TERCERA. El colaborador deberá mantener confidencialidad sobre información interna, administrativa, técnica, operativa o financiera a la que tenga acceso.',

      'CUARTA. El presente contrato es generado por el sistema SMART RH y queda sujeto a validación, autorización y resguardo por parte del área de Recursos Humanos.',

      'QUINTA. Cualquier modificación contractual deberá registrarse formalmente y conservar trazabilidad documental dentro del expediente del empleado.',
    ],
    MARGIN_X,
    155
  );


  drawFooter(
    doc,
    2,
    3
  );


  // ----------------------------------------------------------
  // PÁGINA 3
  // ----------------------------------------------------------

  doc.addPage({
    size: 'LETTER',
    margin: 50,
  });


  drawCompactPageHeader(
    doc,
    data,
    'ACEPTACIÓN Y FIRMAS'
  );


  drawSignaturePage(
    doc,
    data
  );


  drawFooter(
    doc,
    3,
    3
  );


  // ----------------------------------------------------------
  // GENERAR BUFFER
  // ----------------------------------------------------------

  const pdfBuffer =
    await documentToBuffer(doc);


  // ----------------------------------------------------------
  // STORAGE
  // ----------------------------------------------------------

  return await writeStorageObject(
    `contratos/${safeName}`,
    pdfBuffer,
    'application/pdf'
  );
}


// ============================================================
// HEADER PRINCIPAL
// ============================================================

function drawHeader(
  doc: PDFKit.PDFDocument,
  data: ContractData
) {
  doc
    .rect(
      0,
      0,
      PAGE_WIDTH,
      118
    )
    .fill(PRIMARY);


  if (data.logoBuffer?.length) {

    doc
      .roundedRect(
        48,
        24,
        190,
        66,
        10
      )
      .fill('#ffffff');


    doc.image(
      data.logoBuffer,
      64,
      35,
      {
        fit: [
          158,
          42,
        ],

        align: 'center',

        valign: 'center',
      }
    );

  } else {

    doc
      .fillColor('#ffffff')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(
        'SMART RH',
        50,
        38
      );
  }


  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(20);


  doc.text(
    'CONTRATO INDIVIDUAL',
    270,
    28,
    {
      width: 285,
      align: 'right',
      lineBreak: false,
    }
  );


  doc.text(
    'DE TRABAJO',
    270,
    53,
    {
      width: 285,
      align: 'right',
      lineBreak: false,
    }
  );


  doc
    .fillColor('#d9f4f3')
    .font('Helvetica')
    .fontSize(8.5);


  doc.text(
    `Folio: ${data.folio}`,
    270,
    82,
    {
      width: 285,
      align: 'right',
      lineBreak: false,
    }
  );


  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-MX')}`,
    270,
    96,
    {
      width: 285,
      align: 'right',
      lineBreak: false,
    }
  );
}


// ============================================================
// HEADER COMPACTO
// ============================================================

function drawCompactPageHeader(
  doc: PDFKit.PDFDocument,
  data: ContractData,
  title: string
) {
  doc
    .rect(
      0,
      0,
      PAGE_WIDTH,
      92
    )
    .fill(PRIMARY);


  if (data.logoBuffer?.length) {

    doc
      .roundedRect(
        50,
        18,
        150,
        50,
        8
      )
      .fill('#ffffff');


    doc.image(
      data.logoBuffer,
      64,
      27,
      {
        fit: [
          122,
          30,
        ],

        align: 'center',

        valign: 'center',
      }
    );

  } else {

    doc
      .fillColor('#ffffff')
      .fontSize(19)
      .font('Helvetica-Bold')
      .text(
        'SMART RH',
        50,
        30,
        {
          lineBreak: false,
        }
      );
  }


  doc
    .fillColor('#ffffff')
    .fontSize(10)
    .font('Helvetica');


  doc.text(
    'Contrato laboral generado automáticamente',
    230,
    28,
    {
      width: 320,
      align: 'right',
      lineBreak: false,
    }
  );


  doc
    .fillColor('#d9f4f3')
    .fontSize(8)
    .font('Helvetica');


  doc.text(
    `Folio: ${data.folio}`,
    230,
    46,
    {
      width: 320,
      align: 'right',
      lineBreak: false,
    }
  );


  drawSectionTitle(
    doc,
    title,
    MARGIN_X,
    112
  );
}


// ============================================================
// TITULO
// ============================================================

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number
) {
  doc
    .fillColor(PRIMARY)
    .fontSize(15.5)
    .font('Helvetica-Bold');


  doc.text(
    title,
    x,
    y,
    {
      lineBreak: false,
    }
  );


  doc
    .rect(
      x,
      y + 20,
      44,
      3
    )
    .fill(ACCENT);
}


// ============================================================
// INFO BOX
// ============================================================

function drawInfoBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rows: string[][]
) {
  const rowHeight = 23;

  const height =
    rows.length * rowHeight + 26;


  doc
    .roundedRect(
      x,
      y,
      width,
      height,
      10
    )
    .strokeColor(LIGHT_BORDER)
    .lineWidth(1)
    .stroke();


  let currentY = y + 14;


  rows.forEach(
    ([label, value]) => {

      doc
        .fillColor(PRIMARY)
        .fontSize(8.8)
        .font('Helvetica-Bold');


      doc.text(
        label,
        x + 18,
        currentY,
        {
          width: 170,
          lineBreak: false,
        }
      );


      doc
        .fillColor(TEXT)
        .fontSize(8.8)
        .font('Helvetica');


      doc.text(
        safe(value),
        x + 210,
        currentY,
        {
          width:
            width - 235,

          lineBreak:
            false,
        }
      );


      currentY +=
        rowHeight;
    }
  );


  return y + height;
}


// ============================================================
// CLÁUSULAS
// ============================================================

function drawClauses(
  doc: PDFKit.PDFDocument,
  clauses: string[],
  x: number,
  y: number
) {
  let currentY = y;


  clauses.forEach(
    (clause) => {

      const [
        label,
        ...rest
      ] =
        clause.split('. ');


      const body =
        rest.join('. ');


      doc
        .fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold');


      doc.text(
        `${label}.`,
        x,
        currentY,
        {
          width: 70,
          lineBreak: false,
        }
      );


      doc
        .fillColor('#111827')
        .fontSize(10)
        .font('Helvetica');


      doc.text(
        body,
        x + 78,
        currentY,
        {
          width: 434,
          align: 'justify',
          lineGap: 1,
        }
      );


      currentY =
        doc.y + 20;
    }
  );
}


// ============================================================
// FIRMAS
// ============================================================

function drawSignaturePage(
  doc: PDFKit.PDFDocument,
  data: ContractData
) {
  doc
    .fillColor('#222222')
    .fontSize(10.5)
    .font('Helvetica');


  doc.text(
    'Las partes manifiestan que conocen y aceptan el contenido del presente contrato, firmando de conformidad para los efectos administrativos y laborales correspondientes.',
    MARGIN_X,
    165,
    {
      width: 512,
      align: 'justify',
      lineGap: 3,
    }
  );


  drawSignature(
    doc,
    75,
    360,
    'Empleado',
    data.empleado.nombreCompleto
  );


  drawSignature(
    doc,
    340,
    360,
    'Recursos Humanos',
    'Representante autorizado'
  );


  doc
    .fillColor(MUTED)
    .fontSize(8.5)
    .font('Helvetica');


  doc.text(
    `Fecha de firma: ${new Date().toLocaleDateString('es-MX')}`,
    MARGIN_X,
    470,
    {
      width: 512,
      align: 'center',
      lineBreak: false,
    }
  );
}


function drawSignature(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  title: string,
  name: string
) {
  doc
    .strokeColor(PRIMARY)
    .lineWidth(1)
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
    .fillColor(PRIMARY)
    .fontSize(10)
    .font('Helvetica-Bold');


  doc.text(
    title,
    x,
    y + 14,
    {
      width: 190,
      align: 'center',
      lineBreak: false,
    }
  );


  doc
    .fillColor(TEXT)
    .fontSize(9)
    .font('Helvetica');


  doc.text(
    name,
    x,
    y + 32,
    {
      width: 190,
      align: 'center',
      lineBreak: false,
    }
  );
}


// ============================================================
// FOOTER
// ============================================================

function drawFooter(
  doc: PDFKit.PDFDocument,
  page: number,
  totalPages: number
) {
  const footerY = 705;


  doc.save();


  doc
    .strokeColor('#e5edf3')
    .lineWidth(1);


  doc
    .moveTo(
      50,
      footerY
    )
    .lineTo(
      PAGE_WIDTH - 50,
      footerY
    )
    .stroke();


  doc
    .fillColor(MUTED)
    .fontSize(7)
    .font('Helvetica');


  doc.text(
    'Documento generado automáticamente por SMART RH. Conservar en expediente laboral.',
    50,
    footerY + 10,
    {
      width: 360,
      height: 10,
      align: 'left',
      lineBreak: false,
    }
  );


  doc.text(
    `Página ${page} de ${totalPages}`,
    465,
    footerY + 10,
    {
      width: 95,
      height: 10,
      align: 'right',
      lineBreak: false,
    }
  );


  doc.restore();
}


// ============================================================
// PDF SIMPLE
// ============================================================

export async function generarPdfSimple(
  folder:
    | 'contratos'
    | 'credenciales'
    | 'documentos',

  filename: string,

  lines: string[]
): Promise<string> {
  const safeName =
    filename.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );


  const doc =
    new PDFDocument({
      size: 'LETTER',
      margin: 50,
      autoFirstPage: false,
    });


  doc.addPage({
    size: 'LETTER',
    margin: 50,
  });


  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(
      lines[0] ||
        'SMART RH',
      {
        align: 'center',
      }
    );


  doc.moveDown();


  lines
    .slice(1)
    .forEach(
      (line) => {

        doc
          .fontSize(11)
          .font('Helvetica')
          .text(line);


        doc.moveDown(0.4);
      }
    );


  const pdfBuffer =
    await documentToBuffer(doc);


  return await writeStorageObject(
    `${folder}/${safeName}`,
    pdfBuffer,
    'application/pdf'
  );
}