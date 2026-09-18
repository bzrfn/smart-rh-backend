import path from 'path';

import sharp from 'sharp';

import QRCode from 'qrcode';

import {
  addOneCalendarMonthClamped,
  buildCredentialQrPayload,
  createCredentialVerificationToken,
  credentialEmployeeCode,
  hashCredentialVerificationToken,
  isCredentialVerificationToken,
} from './credential.utils.js';

import { AppError } from '../../utils/AppError.js';

import {
  getStorageContentType,
  readStorageObject,
  storageKeyFromPublicPath,
  writeStorageObject,
} from '../../config/storage.js';

import {
  buildContractPdfBuffer,
  buildCredentialSvg,
} from '../../utils/documentDesign.js';

import {
  registrarAuditoria,
} from '../auditoria/auditoria.service.js';

import {
  DocumentoGeneradoModel,
} from './documentos.model.js';

import {
  findActiveContratoByUser,
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
// CREDENCIAL VERIFICABLE - REGISTRO OBLIGATORIO
// ============================================================

async function registrarCredencialVerificableMongo(
  params: {
    usuarioId: number;
    archivoUrl: string;
    actorId?: number;
    contratoId: number;
    fechaInicio?: string | Date | null;
    fechaFin?: string | Date | null;
    vigencia: string;
    verificationTokenHash: string;
  }
) {
  await DocumentoGeneradoModel.create({
    usuario_id:
      params.usuarioId,

    tipo:
      'CREDENCIAL_IMAGEN',

    archivo_url:
      params.archivoUrl,

    generado_por:
      params.actorId,

    estatus:
      'GENERADO',

    metadata: {
      usuario_id:
        params.usuarioId,

      contrato_id:
        params.contratoId,

      fecha_inicio:
        params.fechaInicio,

      fecha_fin:
        params.fechaFin,

      vigencia:
        params.vigencia,

      verification_token_hash:
        params.verificationTokenHash,
    },
  });
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

  const filename =
    `contrato_${usuarioId}_${contrato.id}_${Date.now()}.pdf`;

  // ----------------------------------------------------------
  // LOGO CORPORATIVO
  // ----------------------------------------------------------

  const logoBuffer =
    await getSmartRhLogo();

  // ----------------------------------------------------------
  // PDF PROFESIONAL EN MEMORIA
  // ----------------------------------------------------------

  const pdfBuffer =
    await buildContractPdfBuffer({
      folio,

      logoBuffer,

      empleado: {
        id:
          Number(
            user.id
          ),

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

  // ----------------------------------------------------------
  // STORAGE LOCAL / S3 PRIVADO
  // ----------------------------------------------------------

  const archivoUrl =
    await writeStorageObject(
      `contratos/${filename}`,
      pdfBuffer,
      'application/pdf'
    );

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
    await findActiveContratoByUser(
      usuarioId
    );


  if (!contrato) {
    throw new AppError(
      'El usuario no tiene contrato activo',
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
    addOneCalendarMonthClamped(
      new Date()
    );


  // ----------------------------------------------------------
  // QR
  // ----------------------------------------------------------

  const verificationToken =
    createCredentialVerificationToken();


  const verificationTokenHash =
    hashCredentialVerificationToken(
      verificationToken
    );


  const qrPayload =
    buildCredentialQrPayload(
      verificationToken
    );


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


  // ----------------------------------------------------------
  // DISEÑO INSTITUCIONAL
  // ----------------------------------------------------------

  const svg =
    buildCredentialSvg({
      width,
      height,

      employeeId:
        Number(
          user.id
        ),

      nombreCompleto,

      rol,

      correo:
        safeText(
          user.correo
        ),

      fechaInicioContrato:
        contrato.fecha_inicio,

      fechaFinContrato:
        contrato.fecha_fin,

      vigencia,

      logoBase64,

      qrBase64,

      profileImage,
    });


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


  await registrarCredencialVerificableMongo({
    usuarioId,

    archivoUrl,

    actorId,

    contratoId:
      Number(
        contrato.id
      ),

    fechaInicio:
      contrato.fecha_inicio,

    fechaFin:
      contrato.fecha_fin,

    vigencia:
      vigencia.toISOString(),

    verificationTokenHash,
  });


  await setUserCredencial(
    usuarioId,
    archivoUrl
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


function invalidCredentialVerification() {
  return {
    valida: false,
    estado: 'NO_VALIDA' as const,
  };
}


export async function verificarCredencialToken(
  rawToken: string
) {
  const token =
    String(
      rawToken || ''
    ).trim();


  if (
    !isCredentialVerificationToken(
      token
    )
  ) {
    return invalidCredentialVerification();
  }


  const tokenHash =
    hashCredentialVerificationToken(
      token
    );


  const documento: any =
    await DocumentoGeneradoModel
      .findOne({
        tipo:
          'CREDENCIAL_IMAGEN',

        estatus:
          'GENERADO',

        'metadata.verification_token_hash':
          tokenHash,
      })
      .lean();


  if (!documento) {
    return invalidCredentialVerification();
  }


  const metadata =
    documento.metadata || {};


  const vigencia =
    new Date(
      metadata.vigencia
    );


  if (
    Number.isNaN(
      vigencia.getTime()
    ) ||
    vigencia.getTime() <=
      Date.now()
  ) {
    return invalidCredentialVerification();
  }


  const usuarioId =
    Number(
      documento.usuario_id
    );


  if (
    !Number.isInteger(usuarioId) ||
    usuarioId <= 0
  ) {
    return invalidCredentialVerification();
  }


  const user =
    await findUserDocumentData(
      usuarioId
    );


  if (
    !user ||
    Number(
      user.activo
    ) !== 1
  ) {
    return invalidCredentialVerification();
  }


  if (
    String(
      user.credencial_url || ''
    ) !==
    String(
      documento.archivo_url || ''
    )
  ) {
    return invalidCredentialVerification();
  }


  const contrato =
    await findActiveContratoByUser(
      usuarioId
    );


  if (
    !contrato ||
    Number(
      contrato.id
    ) !==
    Number(
      metadata.contrato_id
    )
  ) {
    return invalidCredentialVerification();
  }


  const nombreCompleto =
    `${safeText(
      user.nombre,
      ''
    )} ${safeText(
      user.apellido,
      ''
    )}`.trim();


  return {
    valida: true,

    estado:
      'VIGENTE' as const,

    empleado: {
      codigo:
        credentialEmployeeCode(
          usuarioId
        ),

      nombre:
        nombreCompleto,

      rol:
        safeText(
          user.rol_nombre,
          'Empleado'
        ),
    },

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
