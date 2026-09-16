import path from 'path';

import sharp from 'sharp';

import QRCode from 'qrcode';

import { AppError } from '../../utils/AppError.js';

import {
  getStorageContentType,
  readStorageObject,
  storageKeyFromPublicPath,
  writeStorageObject,
} from '../../config/storage.js';

import {
  generarContratoProfesionalPdf,
} from '../../utils/pdfGenerator.js';

import {
  registrarAuditoria,
} from '../auditoria/auditoria.service.js';

import {
  DocumentoGeneradoModel,
} from './documentos.model.js';

import {
  findLatestContratoByUser,
  findUserDocumentData,
  setContratoPdf,
  setUserCredencial,
  setUserFotoPerfil,
} from './documentos.repository.js';


// ============================================================
// FORMATO FECHAS
// ============================================================

function formatDate(
  value?: string | Date | null
) {
  if (!value) {
    return 'No definida';
  }

  return new Date(
    value
  ).toLocaleDateString(
    'es-MX',
    {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }
  );
}


function formatDateShort(
  value?: string | Date | null
) {
  if (!value) {
    return 'Indefinido';
  }

  return new Date(
    value
  ).toLocaleDateString(
    'es-MX',
    {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }
  );
}


// ============================================================
// HELPERS
// ============================================================

function safeText(
  value: any,
  fallback = 'No registrado'
) {
  return (
    value === null ||
    value === undefined ||
    value === ''
  )
    ? fallback
    : String(value);
}


function escapeXml(
  value: any
) {
  return safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


function limitText(
  value: any,
  max = 34
) {
  const text =
    safeText(value);

  return text.length > max
    ? `${text.slice(
        0,
        max - 3
      )}...`
    : text;
}


function formatMoney(
  value: any
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'No registrado';
  }

  const numberValue =
    Number(value);

  if (
    Number.isNaN(
      numberValue
    )
  ) {
    return String(value);
  }

  return numberValue.toLocaleString(
    'es-MX',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}


// ============================================================
// VACACIONES
// ============================================================

function calcularVacaciones(
  fechaInicio?:
    | string
    | Date
    | null
) {
  if (!fechaInicio) {
    return '12 días anuales conforme a la política laboral vigente';
  }


  const inicio =
    new Date(fechaInicio);


  const hoy =
    new Date();


  let antiguedad =
    hoy.getFullYear() -
    inicio.getFullYear();


  const mesDiff =
    hoy.getMonth() -
    inicio.getMonth();


  if (
    mesDiff < 0 ||
    (
      mesDiff === 0 &&
      hoy.getDate() <
        inicio.getDate()
    )
  ) {
    antiguedad -= 1;
  }


  if (antiguedad <= 0) {
    return '12 días anuales';
  }

  if (antiguedad === 1) {
    return '12 días anuales';
  }

  if (antiguedad === 2) {
    return '14 días anuales';
  }

  if (antiguedad === 3) {
    return '16 días anuales';
  }

  if (antiguedad === 4) {
    return '18 días anuales';
  }

  if (
    antiguedad >= 5 &&
    antiguedad <= 9
  ) {
    return '20 días anuales';
  }

  if (
    antiguedad >= 10 &&
    antiguedad <= 14
  ) {
    return '22 días anuales';
  }

  if (
    antiguedad >= 15 &&
    antiguedad <= 19
  ) {
    return '24 días anuales';
  }

  return '26 días anuales';
}


// ============================================================
// MIME FOTO
// ============================================================

function getImageMimeType(
  filename: string
): string {
  return getStorageContentType(
    filename
  );
}


// ============================================================
// EXTENSIÓN FOTO
// ============================================================

function getSafeProfileExtension(
  filename?: string
): string {
  const extension =
    path
      .extname(
        filename || ''
      )
      .toLowerCase()
      .replace('.', '');


  const allowed =
    new Set([
      'png',
      'jpg',
      'jpeg',
      'webp',
    ]);


  if (
    extension &&
    allowed.has(extension)
  ) {
    return extension;
  }


  return 'png';
}


// ============================================================
// LEER IMAGEN DESDE STORAGE
// ============================================================

async function getImageBase64FromUpload(
  fileUrl?: string | null
): Promise<{
  mime: string;
  base64: string;
} | null> {
  const key =
    storageKeyFromPublicPath(
      fileUrl
    );


  if (!key) {
    return null;
  }


  const object =
    await readStorageObject(
      key
    );


  if (!object) {
    return null;
  }


  return {
    mime:
      object.contentType ||
      getImageMimeType(key),

    base64:
      object.body.toString(
        'base64'
      ),
  };
}


// ============================================================
// LOGO SMART RH
// ============================================================

async function getSmartRhLogo():
Promise<Buffer | null> {
  const logo =
    await readStorageObject(
      'empresa/logo-smart-rh.jpeg'
    );


  return logo?.body || null;
}


// ============================================================
// REGISTRO DOCUMENTO MONGODB
// ============================================================

async function registrarDocumentoMongo(
  usuarioId: number,

  tipo: string,

  archivoUrl: string,

  actorId?: number,

  metadata?: object
) {
  try {
    await DocumentoGeneradoModel.create({
      usuario_id: usuarioId,

      tipo,

      archivo_url:
        archivoUrl,

      generado_por:
        actorId,

      estatus:
        'GENERADO',

      metadata,
    });

  } catch (error) {

    console.error(
      '[DOCUMENTOS] No se pudo registrar documento en MongoDB:',
      error
    );
  }
}


// ============================================================
// FOTO DE PERFIL
// ============================================================

export async function guardarFotoPerfil(
  params: {
    usuarioId: number;

    base64: string;

    filename?: string;

    ip?: string;

    actorId?: number;
  }
) {
  const user =
    await findUserDocumentData(
      params.usuarioId
    );


  if (!user) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }


  const raw =
    params.base64.includes(',')
      ? params.base64
          .split(',')
          .pop()!
      : params.base64;


  const buffer =
    Buffer.from(
      raw,
      'base64'
    );


  if (!buffer.length) {
    throw new AppError(
      'La foto de perfil no es válida',
      400
    );
  }


  const extension =
    getSafeProfileExtension(
      params.filename
    );


  const filename =
    `perfil_${params.usuarioId}_${Date.now()}.${extension}`;


  const storageKey =
    `profiles/${filename}`;


  const fotoUrl =
    await writeStorageObject(
      storageKey,
      buffer,
      getImageMimeType(filename)
    );


  await setUserFotoPerfil(
    params.usuarioId,
    fotoUrl
  );


  await registrarDocumentoMongo(
    params.usuarioId,
    'FOTO_PERFIL',
    fotoUrl,
    params.actorId
  );


  await registrarAuditoria({
    usuario_id:
      params.actorId,

    modulo:
      'usuarios',

    accion:
      'ACTUALIZAR_FOTO_PERFIL',

    descripcion:
      `Se actualizó la foto de perfil del usuario ${params.usuarioId}`,

    ip:
      params.ip,

    metadata: {
      usuario_id:
        params.usuarioId,

      archivo_url:
        fotoUrl,
    },
  });


  return {
    foto_perfil_url:
      fotoUrl,
  };
}


// ============================================================
// CONTRATO PDF
// ============================================================

export async function generarContratoPdf(
  usuarioId: number,

  actorId?: number,

  ip?: string
) {
  const user =
    await findUserDocumentData(
      usuarioId
    );


  if (!user) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }


  const contrato =
    await findLatestContratoByUser(
      usuarioId
    );


  if (!contrato) {
    throw new AppError(
      'El usuario no tiene contrato registrado',
      404
    );
  }


  const nombreCompleto =
    `${safeText(
      user.nombre,
      ''
    )} ${safeText(
      user.apellido,
      ''
    )}`.trim();


  const vacaciones =
    calcularVacaciones(
      contrato.fecha_inicio ||
        user.fecha_ingreso
    );


  const folio =
    `CTR-${usuarioId}-${contrato.id}-${Date.now()}`;


  const logoBuffer =
    await getSmartRhLogo();


  const archivoUrl =
    await generarContratoProfesionalPdf({
      filename:
        `contrato_${usuarioId}_${contrato.id}_${Date.now()}.pdf`,

      logoBuffer,

      folio,

      empleado: {
        id:
          Number(user.id),

        nombreCompleto,

        correo:
          safeText(
            user.correo
          ),

        telefono:
          safeText(
            user.telefono
          ),

        direccion:
          safeText(
            user.direccion
          ),

        puesto:
          safeText(
            user.rol_nombre,
            'Empleado'
          ),

        fechaIngreso:
          formatDate(
            user.fecha_ingreso
          ),
      },

      contrato: {
        tipo:
          safeText(
            contrato.tipo_contrato
          ),

        salario:
          formatMoney(
            contrato.salario_base
          ),

        fechaInicio:
          formatDate(
            contrato.fecha_inicio
          ),

        fechaFin:
          contrato.fecha_fin
            ? formatDate(
                contrato.fecha_fin
              )
            : 'Indefinido',

        estado:
          safeText(
            contrato.estado
          ),

        vacaciones,
      },
    });


  await setContratoPdf(
    Number(
      contrato.id
    ),
    archivoUrl
  );


  await registrarDocumentoMongo(
    usuarioId,
    'CONTRATO',
    archivoUrl,
    actorId,
    {
      contrato_id:
        contrato.id,

      folio,

      salario_base:
        contrato.salario_base,

      vacaciones,
    }
  );


  await registrarAuditoria({
    usuario_id:
      actorId,

    modulo:
      'contratos',

    accion:
      'GENERAR_CONTRATO_PDF',

    descripcion:
      `Se generó contrato PDF profesional para el usuario ${usuarioId}`,

    ip,

    metadata: {
      usuario_id:
        usuarioId,

      contrato_id:
        contrato.id,

      folio,

      archivo_url:
        archivoUrl,
    },
  });


  return {
    contrato_id:
      contrato.id,

    contrato_pdf_url:
      archivoUrl,

    folio,
  };
}


// ============================================================
// CREDENCIAL DIGITAL
// ============================================================

export async function generarCredencialImagen(
  usuarioId: number,

  actorId?: number,

  ip?: string
) {
  const user =
    await findUserDocumentData(
      usuarioId
    );


  if (!user) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }


  const contrato =
    await findLatestContratoByUser(
      usuarioId
    );


  if (!contrato) {
    throw new AppError(
      'El usuario no tiene contrato registrado',
      404
    );
  }


  const width = 720;

  const height = 1280;


  const nombreCompleto =
    `${safeText(
      user.nombre,
      ''
    )} ${safeText(
      user.apellido,
      ''
    )}`.trim();


  const rol =
    safeText(
      user.rol_nombre,
      'Empleado'
    );


  const fechaInicioContrato =
    formatDateShort(
      contrato.fecha_inicio
    );


  const fechaFinContrato =
    contrato.fecha_fin
      ? formatDateShort(
          contrato.fecha_fin
        )
      : 'Indefinido';


  const vigencia =
    new Date();


  vigencia.setMonth(
    vigencia.getMonth() + 1
  );


  // ----------------------------------------------------------
  // QR
  // ----------------------------------------------------------

  const qrPayload =
    JSON.stringify({
      tipo:
        'CREDENCIAL_SMART_RH',

      usuario_id:
        user.id,

      nombre:
        nombreCompleto,

      correo:
        user.correo,

      fecha_inicio:
        contrato.fecha_inicio,

      fecha_fin:
        contrato.fecha_fin,

      vigencia:
        vigencia.toISOString(),
    });


  const qrDataUrl =
    await QRCode.toDataURL(
      qrPayload,
      {
        margin: 1,
        width: 190,
      }
    );


  const qrBase64 =
    qrDataUrl.split(',')[1];


  // ----------------------------------------------------------
  // LOGO
  // ----------------------------------------------------------

  const logoBuffer =
    await getSmartRhLogo();


  const logoBase64 =
    logoBuffer
      ? logoBuffer.toString(
          'base64'
        )
      : '';


  // ----------------------------------------------------------
  // FOTO PERFIL
  // ----------------------------------------------------------

  const profileImage =
    await getImageBase64FromUpload(
      user.foto_perfil_url
    );


  const initial =
    escapeXml(
      nombreCompleto
        .slice(
          0,
          1
        )
        .toUpperCase()
    );


  const avatarContent =
    profileImage
      ? `
        <image
          href="data:${profileImage.mime};base64,${profileImage.base64}"
          x="254"
          y="212"
          width="212"
          height="212"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `
      : `
        <text
          x="360"
          y="345"
          text-anchor="middle"
          font-size="78"
          font-weight="800"
          fill="#073b5a"
        >
          ${initial}
        </text>
      `;


  // ----------------------------------------------------------
  // SVG
  // ----------------------------------------------------------

  const svg = `
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
            stop-color="#062b46"
          />

          <stop
            offset="55%"
            stop-color="#057d8c"
          />

          <stop
            offset="100%"
            stop-color="#0fb3a8"
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
            dy="10"
            stdDeviation="10"
            flood-color="#0b2f45"
            flood-opacity="0.18"
          />
        </filter>

        <clipPath
          id="avatarClip"
        >
          <circle
            cx="360"
            cy="318"
            r="106"
          />
        </clipPath>
      </defs>


      <rect
        width="720"
        height="1280"
        rx="46"
        fill="#f4f8fb"
      />


      <rect
        x="0"
        y="0"
        width="720"
        height="292"
        rx="46"
        fill="url(#headerBg)"
      />


      <rect
        x="0"
        y="245"
        width="720"
        height="72"
        fill="#f4f8fb"
      />


      ${
        logoBase64
          ? `
            <rect
              x="130"
              y="58"
              width="460"
              height="128"
              rx="18"
              fill="#ffffff"
              opacity="0.96"
            />

            <image
              href="data:image/jpeg;base64,${logoBase64}"
              x="150"
              y="78"
              width="420"
              height="88"
              preserveAspectRatio="xMidYMid meet"
            />
          `
          : `
            <text
              x="360"
              y="132"
              text-anchor="middle"
              font-size="54"
              font-weight="800"
              fill="#ffffff"
            >
              SMART RH
            </text>

            <text
              x="360"
              y="172"
              text-anchor="middle"
              font-size="18"
              font-weight="600"
              fill="#dff9f7"
            >
              Recursos Humanos Inteligentes
            </text>
          `
      }


      <circle
        cx="360"
        cy="318"
        r="116"
        fill="#ffffff"
        stroke="#0aa6a6"
        stroke-width="8"
        filter="url(#shadow)"
      />


      ${avatarContent}


      <text
        x="360"
        y="505"
        text-anchor="middle"
        font-size="38"
        font-weight="800"
        fill="#073b5a"
      >
        ${escapeXml(
          limitText(
            nombreCompleto,
            28
          )
        )}
      </text>


      <text
        x="360"
        y="555"
        text-anchor="middle"
        font-size="25"
        font-weight="700"
        fill="#0aa6a6"
      >
        ${escapeXml(
          limitText(
            rol,
            30
          )
        )}
      </text>


      <rect
        x="66"
        y="615"
        width="588"
        height="270"
        rx="30"
        fill="#ffffff"
        stroke="#dbe7ee"
        filter="url(#shadow)"
      />


      <text
        x="112"
        y="675"
        font-size="24"
        font-weight="800"
        fill="#073b5a"
      >
        ID empleado
      </text>


      <text
        x="390"
        y="675"
        font-size="24"
        font-weight="600"
        fill="#263b4a"
      >
        #${escapeXml(
          user.id
        )}
      </text>


      <text
        x="112"
        y="735"
        font-size="24"
        font-weight="800"
        fill="#073b5a"
      >
        Correo
      </text>


      <text
        x="390"
        y="735"
        font-size="22"
        font-weight="500"
        fill="#263b4a"
      >
        ${escapeXml(
          limitText(
            user.correo,
            25
          )
        )}
      </text>


      <text
        x="112"
        y="795"
        font-size="24"
        font-weight="800"
        fill="#073b5a"
      >
        Contrato
      </text>


      <text
        x="390"
        y="795"
        font-size="22"
        font-weight="500"
        fill="#263b4a"
      >
        ${escapeXml(
          fechaInicioContrato
        )}
        -
        ${escapeXml(
          fechaFinContrato
        )}
      </text>


      <text
        x="112"
        y="855"
        font-size="24"
        font-weight="800"
        fill="#073b5a"
      >
        Vigencia
      </text>


      <text
        x="390"
        y="855"
        font-size="22"
        font-weight="500"
        fill="#263b4a"
      >
        ${escapeXml(
          formatDateShort(
            vigencia
          )
        )}
      </text>


      <rect
        x="245"
        y="930"
        width="230"
        height="230"
        rx="26"
        fill="#ffffff"
        stroke="#dbe7ee"
        filter="url(#shadow)"
      />


      <image
        href="data:image/png;base64,${qrBase64}"
        x="265"
        y="950"
        width="190"
        height="190"
      />


      <rect
        x="76"
        y="1200"
        width="568"
        height="48"
        rx="18"
        fill="#073b5a"
      />


      <text
        x="360"
        y="1231"
        text-anchor="middle"
        font-size="19"
        font-weight="800"
        fill="#ffffff"
      >
        CREDENCIAL DIGITAL SMART RH
      </text>
    </svg>
  `;


  // ----------------------------------------------------------
  // PNG EN MEMORIA
  // ----------------------------------------------------------

  const imageBuffer =
    await sharp(
      Buffer.from(svg)
    )
      .png()
      .toBuffer();


  // ----------------------------------------------------------
  // STORAGE
  // ----------------------------------------------------------

  const filename =
    `credencial_${usuarioId}_${Date.now()}.png`;


  const archivoUrl =
    await writeStorageObject(
      `credenciales/${filename}`,
      imageBuffer,
      'image/png'
    );


  await setUserCredencial(
    usuarioId,
    archivoUrl
  );


  await registrarDocumentoMongo(
    usuarioId,
    'CREDENCIAL_IMAGEN',
    archivoUrl,
    actorId,
    {
      usuario_id:
        usuarioId,

      contrato_id:
        contrato.id,

      fecha_inicio:
        contrato.fecha_inicio,

      fecha_fin:
        contrato.fecha_fin,

      vigencia:
        vigencia.toISOString(),
    }
  );


  await registrarAuditoria({
    usuario_id:
      actorId,

    modulo:
      'usuarios',

    accion:
      'GENERAR_CREDENCIAL_IMAGEN',

    descripcion:
      `Se generó credencial en imagen para el usuario ${usuarioId}`,

    ip,

    metadata: {
      usuario_id:
        usuarioId,

      archivo_url:
        archivoUrl,
    },
  });


  return {
    credencial_url:
      archivoUrl,

    vigencia:
      vigencia.toISOString(),
  };
}


// ============================================================
// COMPATIBILIDAD
//
// La ruta antigua /credencial-pdf continúa funcionando,
// aunque actualmente genera la credencial en PNG.
// ============================================================

export const generarCredencialPdf =
  generarCredencialImagen;