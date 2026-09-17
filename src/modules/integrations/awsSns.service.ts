import {
  createVerify,
  X509Certificate,
} from 'node:crypto';

import { AppError } from '../../utils/AppError.js';
import {
  enviarAlertaMonitoreoEmail,
} from '../auth/auth.email.service.js';


export type SnsMessageType =
  | 'Notification'
  | 'SubscriptionConfirmation'
  | 'UnsubscribeConfirmation';


export type SnsEnvelope = {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};


export type MonitoringAlert = {
  alarma: string;
  estado: string;
  motivo: string;
  fecha: string;
  region?: string;
  recurso?: string;
};


type CertificateCacheEntry = {
  pem: string;
  expiresAt: number;
};


type ProcessResult = {
  action:
    | 'subscription-confirmed'
    | 'notification-sent'
    | 'notification-duplicate'
    | 'unsubscribe-confirmation-received';
};


const CERTIFICATE_CACHE_TTL_MS =
  6 * 60 * 60 * 1000;

const DELIVERY_DEDUP_TTL_MS =
  24 * 60 * 60 * 1000;

const MAX_REMOTE_DOCUMENT_BYTES =
  256 * 1024;

const certificateCache =
  new Map<string, CertificateCacheEntry>();

const deliveredMessageIds =
  new Map<string, number>();


function requireString(
  data: Record<string, unknown>,
  key: string
): string {
  const value = data[key];

  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new AppError(
      `Mensaje SNS inválido: falta ${key}.`,
      400
    );
  }

  return value;
}


function optionalString(
  data: Record<string, unknown>,
  key: string
): string | undefined {
  const value = data[key];

  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(
      `Mensaje SNS inválido: ${key}.`,
      400
    );
  }

  return value;
}


export function parseSnsBody(
  body: unknown
): SnsEnvelope {
  let parsed: unknown = body;

  if (Buffer.isBuffer(parsed)) {
    parsed = parsed.toString('utf8');
  }

  if (typeof parsed === 'string') {
    if (
      Buffer.byteLength(
        parsed,
        'utf8'
      ) > MAX_REMOTE_DOCUMENT_BYTES
    ) {
      throw new AppError(
        'Mensaje SNS demasiado grande.',
        413
      );
    }

    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new AppError(
        'El cuerpo SNS no contiene JSON válido.',
        400
      );
    }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new AppError(
      'El cuerpo SNS es inválido.',
      400
    );
  }

  const data =
    parsed as Record<string, unknown>;

  const type =
    requireString(
      data,
      'Type'
    ) as SnsMessageType;

  if (
    ![
      'Notification',
      'SubscriptionConfirmation',
      'UnsubscribeConfirmation',
    ].includes(type)
  ) {
    throw new AppError(
      'Tipo de mensaje SNS no soportado.',
      400
    );
  }

  const envelope: SnsEnvelope = {
    Type: type,
    MessageId:
      requireString(
        data,
        'MessageId'
      ),
    TopicArn:
      requireString(
        data,
        'TopicArn'
      ),
    Message:
      requireString(
        data,
        'Message'
      ),
    Timestamp:
      requireString(
        data,
        'Timestamp'
      ),
    SignatureVersion:
      requireString(
        data,
        'SignatureVersion'
      ),
    Signature:
      requireString(
        data,
        'Signature'
      ),
    SigningCertURL:
      requireString(
        data,
        'SigningCertURL'
      ),
    Subject:
      optionalString(
        data,
        'Subject'
      ),
    SubscribeURL:
      optionalString(
        data,
        'SubscribeURL'
      ),
    Token:
      optionalString(
        data,
        'Token'
      ),
  };

  if (
    type === 'SubscriptionConfirmation' ||
    type === 'UnsubscribeConfirmation'
  ) {
    if (
      !envelope.SubscribeURL ||
      !envelope.Token
    ) {
      throw new AppError(
        'Mensaje de confirmación SNS incompleto.',
        400
      );
    }
  }

  if (
    Number.isNaN(
      Date.parse(
        envelope.Timestamp
      )
    )
  ) {
    throw new AppError(
      'Timestamp SNS inválido.',
      400
    );
  }

  return envelope;
}


function getTopicRegion(
  topicArn: string
): string {
  const parts =
    topicArn.split(':');

  if (
    parts.length < 6 ||
    parts[0] !== 'arn' ||
    parts[2] !== 'sns' ||
    !parts[3]
  ) {
    throw new AppError(
      'Topic ARN de SNS inválido.',
      500
    );
  }

  return parts[3];
}


function trustedSnsHostname(
  topicArn: string
): string {
  return `sns.${getTopicRegion(
    topicArn
  )}.amazonaws.com`;
}


export function isTrustedSnsCertificateUrl(
  rawUrl: string,
  topicArn: string
): boolean {
  try {
    const url =
      new URL(rawUrl);

    if (
      url.protocol !== 'https:' ||
      url.hostname !==
        trustedSnsHostname(
          topicArn
        ) ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      return false;
    }

    return /^\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/.test(
      url.pathname
    );
  } catch {
    return false;
  }
}


export function isTrustedSnsSubscribeUrl(
  rawUrl: string,
  topicArn: string,
  token: string
): boolean {
  try {
    const url =
      new URL(rawUrl);

    if (
      url.protocol !== 'https:' ||
      url.hostname !==
        trustedSnsHostname(
          topicArn
        ) ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.hash !== ''
    ) {
      return false;
    }

    return (
      url.searchParams.get(
        'Action'
      ) === 'ConfirmSubscription' &&
      url.searchParams.get(
        'TopicArn'
      ) === topicArn &&
      url.searchParams.get(
        'Token'
      ) === token
    );
  } catch {
    return false;
  }
}


export function buildSnsStringToSign(
  message: SnsEnvelope
): string {
  const fields:
    Array<[string, string]> =
    message.Type === 'Notification'
      ? [
          [
            'Message',
            message.Message,
          ],
          [
            'MessageId',
            message.MessageId,
          ],
          ...(
            message.Subject !== undefined
              ? [
                  [
                    'Subject',
                    message.Subject,
                  ] as [string, string],
                ]
              : []
          ),
          [
            'Timestamp',
            message.Timestamp,
          ],
          [
            'TopicArn',
            message.TopicArn,
          ],
          [
            'Type',
            message.Type,
          ],
        ]
      : [
          [
            'Message',
            message.Message,
          ],
          [
            'MessageId',
            message.MessageId,
          ],
          [
            'SubscribeURL',
            message.SubscribeURL || '',
          ],
          [
            'Timestamp',
            message.Timestamp,
          ],
          [
            'Token',
            message.Token || '',
          ],
          [
            'TopicArn',
            message.TopicArn,
          ],
          [
            'Type',
            message.Type,
          ],
        ];

  return fields
    .map(
      ([key, value]) =>
        `${key}\n${value}\n`
    )
    .join('');
}


function signatureAlgorithm(
  version: string
): string {
  if (version === '1') {
    return 'RSA-SHA1';
  }

  if (version === '2') {
    return 'RSA-SHA256';
  }

  throw new AppError(
    'Versión de firma SNS no soportada.',
    400
  );
}


export function verifySnsSignatureWithPublicKey(
  message: SnsEnvelope,
  publicKeyPem: string
): boolean {
  const verifier =
    createVerify(
      signatureAlgorithm(
        message.SignatureVersion
      )
    );

  verifier.update(
    buildSnsStringToSign(
      message
    ),
    'utf8'
  );

  verifier.end();

  try {
    return verifier.verify(
      publicKeyPem,
      Buffer.from(
        message.Signature,
        'base64'
      )
    );
  } catch {
    return false;
  }
}


async function fetchTextWithTimeout(
  url: string,
  errorMessage: string
): Promise<string> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      5000
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: 'GET',
          redirect: 'error',
          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new AppError(
        errorMessage,
        502
      );
    }

    const contentLength =
      Number(
        response.headers.get(
          'content-length'
        ) || '0'
      );

    if (
      contentLength >
      MAX_REMOTE_DOCUMENT_BYTES
    ) {
      throw new AppError(
        'Documento remoto SNS demasiado grande.',
        502
      );
    }

    const text =
      await response.text();

    if (
      Buffer.byteLength(
        text,
        'utf8'
      ) >
      MAX_REMOTE_DOCUMENT_BYTES
    ) {
      throw new AppError(
        'Documento remoto SNS demasiado grande.',
        502
      );
    }

    return text;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      errorMessage,
      502
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}


async function getSigningCertificate(
  message: SnsEnvelope
): Promise<X509Certificate> {
  if (
    !isTrustedSnsCertificateUrl(
      message.SigningCertURL,
      message.TopicArn
    )
  ) {
    throw new AppError(
      'URL de certificado SNS no confiable.',
      403
    );
  }

  const cached =
    certificateCache.get(
      message.SigningCertURL
    );

  const now =
    Date.now();

  if (
    cached &&
    cached.expiresAt > now
  ) {
    return new X509Certificate(
      cached.pem
    );
  }

  const pem =
    await fetchTextWithTimeout(
      message.SigningCertURL,
      'No se pudo obtener el certificado SNS.'
    );

  let certificate:
    X509Certificate;

  try {
    certificate =
      new X509Certificate(
        pem
      );
  } catch {
    throw new AppError(
      'Certificado SNS inválido.',
      403
    );
  }

  const validFrom =
    Date.parse(
      certificate.validFrom
    );

  const validTo =
    Date.parse(
      certificate.validTo
    );

  if (
    Number.isNaN(validFrom) ||
    Number.isNaN(validTo) ||
    now < validFrom ||
    now > validTo
  ) {
    throw new AppError(
      'Certificado SNS expirado o no vigente.',
      403
    );
  }

  certificateCache.set(
    message.SigningCertURL,
    {
      pem,
      expiresAt:
        Math.min(
          validTo,
          now +
            CERTIFICATE_CACHE_TTL_MS
        ),
    }
  );

  return certificate;
}


async function verifySnsMessageSignature(
  message: SnsEnvelope
): Promise<boolean> {
  signatureAlgorithm(
    message.SignatureVersion
  );

  const certificate =
    await getSigningCertificate(
      message
    );

  const verifier =
    createVerify(
      signatureAlgorithm(
        message.SignatureVersion
      )
    );

  verifier.update(
    buildSnsStringToSign(
      message
    ),
    'utf8'
  );

  verifier.end();

  try {
    return verifier.verify(
      certificate.publicKey,
      Buffer.from(
        message.Signature,
        'base64'
      )
    );
  } catch {
    return false;
  }
}


function getExpectedTopicArn():
  string {
  const topicArn =
    (
      process.env
        .AWS_SNS_MONITORING_TOPIC_ARN ||
      ''
    ).trim();

  if (!topicArn) {
    throw new AppError(
      'Integración SNS no configurada.',
      503
    );
  }

  return topicArn;
}


function getMonitoringRecipient():
  string {
  const recipient =
    (
      process.env
        .MONITORING_ALERT_EMAIL ||
      process.env.CONTACT_TO ||
      process.env.SMTP_USER ||
      ''
    ).trim();

  if (
    !recipient ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
      recipient
    )
  ) {
    throw new AppError(
      'Correo de monitoreo no configurado.',
      503
    );
  }

  return recipient;
}


async function confirmSubscription(
  message: SnsEnvelope
): Promise<void> {
  const subscribeUrl =
    message.SubscribeURL;

  const token =
    message.Token;

  if (
    !subscribeUrl ||
    !token ||
    !isTrustedSnsSubscribeUrl(
      subscribeUrl,
      message.TopicArn,
      token
    )
  ) {
    throw new AppError(
      'URL de confirmación SNS no confiable.',
      403
    );
  }

  await fetchTextWithTimeout(
    subscribeUrl,
    'No se pudo confirmar la suscripción SNS.'
  );
}


function pruneDeliveredMessageIds():
  void {
  const threshold =
    Date.now() -
    DELIVERY_DEDUP_TTL_MS;

  for (
    const [
      messageId,
      deliveredAt,
    ]
    of deliveredMessageIds
  ) {
    if (
      deliveredAt <
      threshold
    ) {
      deliveredMessageIds.delete(
        messageId
      );
    }
  }
}


function alreadyDelivered(
  messageId: string
): boolean {
  pruneDeliveredMessageIds();

  return deliveredMessageIds.has(
    messageId
  );
}


function markDelivered(
  messageId: string
): void {
  deliveredMessageIds.set(
    messageId,
    Date.now()
  );
}


export function parseCloudWatchNotification(
  rawMessage: string,
  subject?: string
): MonitoringAlert {
  try {
    const parsed =
      JSON.parse(
        rawMessage
      ) as Record<string, unknown>;

    const trigger =
      parsed.Trigger &&
      typeof parsed.Trigger ===
        'object' &&
      !Array.isArray(
        parsed.Trigger
      )
        ? parsed.Trigger as Record<
            string,
            unknown
          >
        : undefined;

    const dimensions =
      trigger &&
      Array.isArray(
        trigger.Dimensions
      )
        ? trigger.Dimensions
        : [];

    const resource =
      dimensions
        .map(
          (item) => {
            if (
              !item ||
              typeof item !==
                'object' ||
              Array.isArray(item)
            ) {
              return '';
            }

            const dimension =
              item as Record<
                string,
                unknown
              >;

            const name =
              typeof dimension.name ===
              'string'
                ? dimension.name
                : '';

            const value =
              typeof dimension.value ===
              'string'
                ? dimension.value
                : '';

            if (
              !name ||
              !value
            ) {
              return '';
            }

            return `${name}=${value}`;
          }
        )
        .filter(Boolean)
        .join(', ');

    return {
      alarma:
        typeof parsed.AlarmName ===
        'string'
          ? parsed.AlarmName
          : (
              subject ||
              'Notificación de monitoreo'
            ),

      estado:
        typeof parsed.NewStateValue ===
        'string'
          ? parsed.NewStateValue
          : 'NOTIFICACION',

      motivo:
        typeof parsed.NewStateReason ===
        'string'
          ? parsed.NewStateReason
          : rawMessage.slice(
              0,
              3000
            ),

      fecha:
        typeof parsed.StateChangeTime ===
        'string'
          ? parsed.StateChangeTime
          : new Date().toISOString(),

      region:
        typeof parsed.Region ===
        'string'
          ? parsed.Region
          : undefined,

      recurso:
        resource ||
        undefined,
    };
  } catch {
    return {
      alarma:
        subject ||
        'Notificación de monitoreo',

      estado:
        'NOTIFICACION',

      motivo:
        rawMessage.slice(
          0,
          3000
        ),

      fecha:
        new Date().toISOString(),
    };
  }
}


export async function processSnsMessage(
  message: SnsEnvelope
): Promise<ProcessResult> {
  const expectedTopicArn =
    getExpectedTopicArn();

  if (
    message.TopicArn !==
    expectedTopicArn
  ) {
    throw new AppError(
      'Topic SNS no autorizado.',
      403
    );
  }

  const signatureValid =
    await verifySnsMessageSignature(
      message
    );

  if (!signatureValid) {
    throw new AppError(
      'Firma SNS inválida.',
      403
    );
  }

  if (
    message.Type ===
    'SubscriptionConfirmation'
  ) {
    await confirmSubscription(
      message
    );

    console.log(
      `[SNS] Suscripción confirmada. MessageId=${message.MessageId}`
    );

    return {
      action:
        'subscription-confirmed',
    };
  }

  if (
    message.Type ===
    'UnsubscribeConfirmation'
  ) {
    console.warn(
      `[SNS] Confirmación de baja recibida. MessageId=${message.MessageId}`
    );

    return {
      action:
        'unsubscribe-confirmation-received',
    };
  }

  if (
    alreadyDelivered(
      message.MessageId
    )
  ) {
    console.log(
      `[SNS] Notificación duplicada omitida. MessageId=${message.MessageId}`
    );

    return {
      action:
        'notification-duplicate',
    };
  }

  const alert =
    parseCloudWatchNotification(
      message.Message,
      message.Subject
    );

  const recipient =
    getMonitoringRecipient();

  await enviarAlertaMonitoreoEmail({
    correo:
      recipient,
    alarma:
      alert.alarma,
    estado:
      alert.estado,
    motivo:
      alert.motivo,
    fecha:
      alert.fecha ||
      message.Timestamp,
    region:
      alert.region,
    recurso:
      alert.recurso,
  });

  markDelivered(
    message.MessageId
  );

  console.log(
    `[SNS] Alerta enviada. MessageId=${message.MessageId} Alarm=${alert.alarma}`
  );

  return {
    action:
      'notification-sent',
  };
}
