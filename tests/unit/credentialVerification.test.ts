import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


jest.mock(
  '../../src/modules/documentos/documentos.model.js',
  () => ({
    DocumentoGeneradoModel: {
      create:
        jest.fn(),

      findOne:
        jest.fn(),
    },
  })
);


jest.mock(
  '../../src/modules/documentos/documentos.repository.js',
  () => ({
    findActiveContratoByUser:
      jest.fn(),

    findLatestContratoByUser:
      jest.fn(),

    findUserDocumentData:
      jest.fn(),

    setContratoPdf:
      jest.fn(),

    setUserCredencial:
      jest.fn(),

    setUserFotoPerfil:
      jest.fn(),
  })
);


import {
  DocumentoGeneradoModel,
} from '../../src/modules/documentos/documentos.model.js';

import {
  findActiveContratoByUser,
  findUserDocumentData,
} from '../../src/modules/documentos/documentos.repository.js';

import {
  buildCredentialQrPayload,
  createCredentialVerificationToken,
  hashCredentialVerificationToken,
} from '../../src/modules/documentos/credential.utils.js';

import {
  verificarCredencialToken,
} from '../../src/modules/documentos/documentos.service.js';


const findDocumentMock =
  DocumentoGeneradoModel
    .findOne as unknown as jest.Mock;

const findUserMock =
  findUserDocumentData as jest.Mock;

const findContractMock =
  findActiveContratoByUser as jest.Mock;


function mockDocument(
  value: any
) {
  const lean =
    jest.fn()
      .mockResolvedValue(
        value
      );

  findDocumentMock
    .mockReturnValue({
      lean,
    });

  return lean;
}


describe(
  'Verificacion de credencial digital',
  () => {

    beforeEach(
      () => {
        jest.clearAllMocks();
      }
    );


    test(
      'genera token aleatorio de 256 bits representado en hexadecimal',
      () => {
        const token =
          createCredentialVerificationToken();

        expect(token)
          .toMatch(
            /^[a-f0-9]{64}$/
          );

        expect(token)
          .toHaveLength(64);
      }
    );


    test(
      'el QR contiene solamente tipo y token',
      () => {
        const token =
          'a'.repeat(64);

        const payload =
          JSON.parse(
            buildCredentialQrPayload(
              token
            )
          );

        expect(payload)
          .toEqual({
            tipo:
              'CREDENCIAL_SMART_RH',

            token,
          });

        expect(payload.correo)
          .toBeUndefined();

        expect(payload.nombre)
          .toBeUndefined();

        expect(payload.usuario_id)
          .toBeUndefined();
      }
    );


    test(
      'hash del token no expone el token original',
      () => {
        const token =
          'b'.repeat(64);

        const hash =
          hashCredentialVerificationToken(
            token
          );

        expect(hash)
          .toMatch(
            /^[a-f0-9]{64}$/
          );

        expect(hash)
          .not.toBe(token);
      }
    );


    test(
      'rechaza formato de token invalido sin consultar Mongo',
      async () => {
        const result =
          await verificarCredencialToken(
            'token-invalido'
          );

        expect(result)
          .toEqual({
            valida: false,
            estado: 'NO_VALIDA',
          });

        expect(
          findDocumentMock
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'valida credencial vigente, usuario activo y contrato coincidente',
      async () => {
        const token =
          'c'.repeat(64);

        const archivoUrl =
          '/uploads/credenciales/credencial_7_test.png';

        const vigencia =
          new Date(
            Date.now() +
            24 * 60 * 60 * 1000
          ).toISOString();


        mockDocument({
          usuario_id: 7,

          archivo_url:
            archivoUrl,

          metadata: {
            contrato_id: 42,

            vigencia,
          },
        });


        findUserMock
          .mockResolvedValue({
            id: 7,

            nombre:
              'Brandon',

            apellido:
              'Bernal',

            rol_nombre:
              'Empleado',

            activo: 1,

            credencial_url:
              archivoUrl,
          });


        findContractMock
          .mockResolvedValue({
            id: 42,

            estado:
              'activo',
          });


        const result =
          await verificarCredencialToken(
            token
          );


        expect(
          findDocumentMock
        ).toHaveBeenCalledWith({
          tipo:
            'CREDENCIAL_IMAGEN',

          estatus:
            'GENERADO',

          'metadata.verification_token_hash':
            hashCredentialVerificationToken(
              token
            ),
        });


        expect(result)
          .toEqual({
            valida: true,

            estado:
              'VIGENTE',

            empleado: {
              codigo:
                'EMP-007',

              nombre:
                'Brandon Bernal',

              rol:
                'Empleado',
            },

            vigencia,
          });
      }
    );


    test(
      'rechaza credencial expirada',
      async () => {
        const token =
          'd'.repeat(64);

        mockDocument({
          usuario_id: 7,

          archivo_url:
            '/uploads/credenciales/actual.png',

          metadata: {
            contrato_id: 42,

            vigencia:
              new Date(
                Date.now() -
                60 * 1000
              ).toISOString(),
          },
        });


        const result =
          await verificarCredencialToken(
            token
          );


        expect(result.valida)
          .toBe(false);

        expect(
          findUserMock
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'rechaza usuario inactivo',
      async () => {
        const token =
          'e'.repeat(64);

        const archivoUrl =
          '/uploads/credenciales/actual.png';


        mockDocument({
          usuario_id: 7,

          archivo_url:
            archivoUrl,

          metadata: {
            contrato_id: 42,

            vigencia:
              new Date(
                Date.now() +
                60 * 60 * 1000
              ).toISOString(),
          },
        });


        findUserMock
          .mockResolvedValue({
            id: 7,

            activo: 0,

            credencial_url:
              archivoUrl,
          });


        const result =
          await verificarCredencialToken(
            token
          );


        expect(result.valida)
          .toBe(false);

        expect(
          findContractMock
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'revoca automaticamente una credencial anterior cuando cambia credencial_url',
      async () => {
        const token =
          'f'.repeat(64);


        mockDocument({
          usuario_id: 7,

          archivo_url:
            '/uploads/credenciales/anterior.png',

          metadata: {
            contrato_id: 42,

            vigencia:
              new Date(
                Date.now() +
                60 * 60 * 1000
              ).toISOString(),
          },
        });


        findUserMock
          .mockResolvedValue({
            id: 7,

            activo: 1,

            credencial_url:
              '/uploads/credenciales/nueva.png',
          });


        const result =
          await verificarCredencialToken(
            token
          );


        expect(result.valida)
          .toBe(false);

        expect(
          findContractMock
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'rechaza cuando el contrato activo ya no coincide',
      async () => {
        const token =
          '1'.repeat(64);

        const archivoUrl =
          '/uploads/credenciales/actual.png';


        mockDocument({
          usuario_id: 7,

          archivo_url:
            archivoUrl,

          metadata: {
            contrato_id: 42,

            vigencia:
              new Date(
                Date.now() +
                60 * 60 * 1000
              ).toISOString(),
          },
        });


        findUserMock
          .mockResolvedValue({
            id: 7,

            activo: 1,

            credencial_url:
              archivoUrl,
          });


        findContractMock
          .mockResolvedValue({
            id: 99,

            estado:
              'activo',
          });


        const result =
          await verificarCredencialToken(
            token
          );


        expect(result.valida)
          .toBe(false);
      }
    );


    test(
      'ruta de verificacion es publica y no exige authJwt',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/documentos/documentos.routes.ts'
            ),
            'utf8'
          );


        expect(source)
          .toMatch(
            /documentosRoutes\.get\(\s*'\/credenciales\/verificar\/:token',\s*verificarCredencialController\s*\);/s
          );
      }
    );
  }
);
