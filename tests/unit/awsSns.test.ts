import {
  createSign,
  generateKeyPairSync,
} from 'node:crypto';

import {
  buildSnsStringToSign,
  isTrustedSnsCertificateUrl,
  isTrustedSnsSubscribeUrl,
  parseCloudWatchNotification,
  SnsEnvelope,
  verifySnsSignatureWithPublicKey,
} from '../../src/modules/integrations/awsSns.service.js';


const TOPIC =
  'arn:aws:sns:us-east-1:682530816594:smarth-rh-production-alerts';


function notification():
  SnsEnvelope {
  return {
    Type:
      'Notification',

    MessageId:
      'message-123',

    TopicArn:
      TOPIC,

    Subject:
      'ALARM: prueba',

    Message:
      '{"AlarmName":"backend-cpu-high"}',

    Timestamp:
      '2026-09-17T16:00:00.000Z',

    SignatureVersion:
      '2',

    Signature:
      'placeholder',

    SigningCertURL:
      'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
  };
}


describe(
  'AWS SNS security helpers',
  () => {
    test(
      'acepta únicamente certificado SNS confiable',
      () => {
        expect(
          isTrustedSnsCertificateUrl(
            'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
            TOPIC
          )
        ).toBe(true);

        expect(
          isTrustedSnsCertificateUrl(
            'http://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
            TOPIC
          )
        ).toBe(false);

        expect(
          isTrustedSnsCertificateUrl(
            'https://sns.us-east-1.amazonaws.com.evil.example/SimpleNotificationService-abc123.pem',
            TOPIC
          )
        ).toBe(false);

        expect(
          isTrustedSnsCertificateUrl(
            'https://sns.us-east-1.amazonaws.com/otro.pem',
            TOPIC
          )
        ).toBe(false);
      }
    );


    test(
      'acepta únicamente URL de confirmación del topic esperado',
      () => {
        const url =
          new URL(
            'https://sns.us-east-1.amazonaws.com/'
          );

        url.searchParams.set(
          'Action',
          'ConfirmSubscription'
        );

        url.searchParams.set(
          'TopicArn',
          TOPIC
        );

        url.searchParams.set(
          'Token',
          'token-seguro'
        );

        expect(
          isTrustedSnsSubscribeUrl(
            url.toString(),
            TOPIC,
            'token-seguro'
          )
        ).toBe(true);

        expect(
          isTrustedSnsSubscribeUrl(
            url.toString(),
            TOPIC,
            'otro-token'
          )
        ).toBe(false);
      }
    );


    test(
      'construye la cadena canónica SNS en orden correcto',
      () => {
        const message =
          notification();

        expect(
          buildSnsStringToSign(
            message
          )
        ).toBe(
          [
            'Message',
            message.Message,
            'MessageId',
            message.MessageId,
            'Subject',
            message.Subject,
            'Timestamp',
            message.Timestamp,
            'TopicArn',
            message.TopicArn,
            'Type',
            message.Type,
            '',
          ].join('\n')
        );
      }
    );


    test(
      'verifica firma RSA SHA256 y rechaza mensaje alterado',
      () => {
        const {
          privateKey,
          publicKey,
        } =
          generateKeyPairSync(
            'rsa',
            {
              modulusLength:
                2048,
            }
          );

        const unsigned =
          notification();

        const signer =
          createSign(
            'RSA-SHA256'
          );

        signer.update(
          buildSnsStringToSign(
            unsigned
          ),
          'utf8'
        );

        signer.end();

        const signature =
          signer.sign(
            privateKey,
            'base64'
          );

        const signed:
          SnsEnvelope = {
          ...unsigned,
          Signature:
            signature,
        };

        const publicPem =
          publicKey
            .export({
              type: 'spki',
              format: 'pem',
            })
            .toString();

        expect(
          verifySnsSignatureWithPublicKey(
            signed,
            publicPem
          )
        ).toBe(true);

        expect(
          verifySnsSignatureWithPublicKey(
            {
              ...signed,
              Message:
                'mensaje alterado',
            },
            publicPem
          )
        ).toBe(false);
      }
    );
  }
);


describe(
  'CloudWatch notification parser',
  () => {
    test(
      'extrae datos operativos de una alarma',
      () => {
        const result =
          parseCloudWatchNotification(
            JSON.stringify({
              AlarmName:
                'smarth-rh-production-backend-cpu-high',

              NewStateValue:
                'ALARM',

              NewStateReason:
                'Threshold Crossed',

              StateChangeTime:
                '2026-09-17T16:00:00.000Z',

              Region:
                'US East (N. Virginia)',

              Trigger: {
                Dimensions: [
                  {
                    name:
                      'InstanceId',

                    value:
                      'i-017f10e3aa6972721',
                  },
                ],
              },
            })
          );

        expect(
          result.alarma
        ).toBe(
          'smarth-rh-production-backend-cpu-high'
        );

        expect(
          result.estado
        ).toBe(
          'ALARM'
        );

        expect(
          result.recurso
        ).toBe(
          'InstanceId=i-017f10e3aa6972721'
        );
      }
    );
  }
);
