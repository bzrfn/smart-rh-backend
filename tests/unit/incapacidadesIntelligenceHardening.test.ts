// @ts-nocheck

import fs from 'node:fs';


function read(
  path: string
): string {
  return fs.readFileSync(
    path,
    'utf8'
  );
}


describe(
  'Incapacidades inteligentes - hardening de storage y SHA',
  () => {
    const storage =
      read(
        'src/config/storage.ts'
      );

    const service =
      read(
        'src/modules/incapacidades/incapacidades.service.ts'
      );

    const repository =
      read(
        'src/modules/incapacidades/incapacidades.intelligence.repository.ts'
      );


    test(
      'deleteStorageObject cubre local y S3',
      () => {
        expect(
          storage
        ).toContain(
          'export async function deleteStorageObject'
        );

        expect(
          storage
        ).toContain(
          'fs.promises.unlink'
        );

        expect(
          storage
        ).toContain(
          'DeleteObjectCommand'
        );

        expect(
          storage
        ).toContain(
          'new DeleteObjectCommand({'
        );

        expect(
          storage
        ).toMatch(
          /ENOENT[\s\S]*return;/
        );
      }
    );


    test(
      'deleteStorageObject no se importa desde node crypto',
      () => {
        const cryptoStart =
          service.indexOf(
            "import {\n  randomUUID,"
          );

        const cryptoEnd =
          service.indexOf(
            "} from 'node:crypto';",
            cryptoStart
          );

        const cryptoScope =
          service.slice(
            cryptoStart,
            cryptoEnd
          );

        expect(
          cryptoScope
        ).not.toContain(
          'deleteStorageObject'
        );

        expect(
          service
        ).toContain(
          "deleteStorageObject,\n  publicUploadPath"
        );
      }
    );


    test(
      'cada intento usa SHA y UUID',
      () => {
        const attach =
          service.slice(
            service.indexOf(
              'export async function attachIncapacidadComprobante'
            )
          );

        expect(
          attach
        ).toContain(
          'analysis.sha256.slice(0, 16)'
        );

        expect(
          attach
        ).toContain(
          '${randomUUID()}'
        );

        expect(
          attach
        ).not.toContain(
          'Date.now()'
        );
      }
    );


    test(
      'fallo de persistencia intenta compensar storage',
      () => {
        const attach =
          service.slice(
            service.indexOf(
              'export async function attachIncapacidadComprobante'
            )
          );

        const writeIndex =
          attach.indexOf(
            'writeStorageObject('
          );

        const persistIndex =
          attach.indexOf(
            'setIncapacidadComprobanteWithAnalysis('
          );

        const catchIndex =
          attach.indexOf(
            'catch (error)',
            persistIndex
          );

        const compensateIndex =
          attach.indexOf(
            'compensateIncapacidadProofStorage(',
            persistIndex
          );

        expect(
          writeIndex
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          persistIndex
        ).toBeGreaterThan(
          writeIndex
        );

        expect(
          catchIndex
        ).toBeGreaterThan(
          persistIndex
        );

        expect(
          compensateIndex
        ).toBeGreaterThan(
          persistIndex
        );

        expect(
          attach
        ).toContain(
          'if (!persistence.updated)'
        );

        expect(
          (
            attach.match(
              /compensateIncapacidadProofStorage\(/g
            ) ||
            []
          ).length
        ).toBeGreaterThanOrEqual(
          2
        );
      }
    );


    test(
      'GET_LOCK ocurre antes de la transacción y de la consulta SHA',
      () => {
        const start =
          repository.indexOf(
            'export async function setIncapacidadComprobanteWithAnalysis'
          );

        const end =
          repository.indexOf(
            '// LECTURA DE RESULTADOS PARA ADMINISTRACION',
            start
          );

        const scope =
          repository.slice(
            start,
            end
          );

        const lockIndex =
          scope.indexOf(
            'GET_LOCK(?, 5)'
          );

        const beginIndex =
          scope.indexOf(
            '.beginTransaction()'
          );

        const shaIndex =
          scope.indexOf(
            'WHERE documento_sha256 = ?'
          );

        expect(
          lockIndex
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          beginIndex
        ).toBeGreaterThan(
          lockIndex
        );

        expect(
          shaIndex
        ).toBeGreaterThan(
          beginIndex
        );

        expect(
          scope
        ).toContain(
          'FOR UPDATE'
        );
      }
    );


    test(
      'named lock se libera o se destruye la conexión',
      () => {
        const start =
          repository.indexOf(
            'export async function setIncapacidadComprobanteWithAnalysis'
          );

        const end =
          repository.indexOf(
            '// LECTURA DE RESULTADOS PARA ADMINISTRACION',
            start
          );

        const scope =
          repository.slice(
            start,
            end
          );

        expect(
          scope
        ).toContain(
          'RELEASE_LOCK(?)'
        );

        expect(
          scope
        ).toContain(
          'connectionReusable'
        );

        expect(
          scope
        ).toContain(
          'connection.release()'
        );

        expect(
          scope
        ).toContain(
          'connection.destroy()'
        );
      }
    );


    test(
      'sigue sin proveedor externo ni aprobación automática',
      () => {
        expect(
          service
        ).not.toMatch(
          /openai|anthropic|gemini|textract|google.?vision|azure.?vision/i
        );

        expect(
          repository
        ).not.toMatch(
          /auto_aprobad|auto_rechazad/i
        );
      }
    );
  }
);
