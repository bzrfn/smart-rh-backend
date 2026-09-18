import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  addOneCalendarMonthClamped,
} from '../../src/modules/documentos/credential.utils.js';


describe(
  'Credencial digital',
  () => {

    describe(
      'vigencia de un mes calendario',
      () => {

        test(
          'mantiene el mismo dia cuando existe',
          () => {
            const original =
              new Date(
                2026,
                0,
                15,
                12,
                0,
                0
              );

            const result =
              addOneCalendarMonthClamped(
                original
              );

            expect(
              result.getFullYear()
            ).toBe(2026);

            expect(
              result.getMonth()
            ).toBe(1);

            expect(
              result.getDate()
            ).toBe(15);
          }
        );


        test(
          'ajusta 31 de enero al ultimo dia de febrero',
          () => {
            const original =
              new Date(
                2026,
                0,
                31,
                12,
                0,
                0
              );

            const result =
              addOneCalendarMonthClamped(
                original
              );

            expect(
              result.getMonth()
            ).toBe(1);

            expect(
              result.getDate()
            ).toBe(28);
          }
        );


        test(
          'respeta febrero de anio bisiesto',
          () => {
            const original =
              new Date(
                2024,
                0,
                31,
                12,
                0,
                0
              );

            const result =
              addOneCalendarMonthClamped(
                original
              );

            expect(
              result.getMonth()
            ).toBe(1);

            expect(
              result.getDate()
            ).toBe(29);
          }
        );


        test(
          'no modifica la fecha original',
          () => {
            const original =
              new Date(
                2026,
                7,
                31,
                12,
                0,
                0
              );

            const timestamp =
              original.getTime();

            const result =
              addOneCalendarMonthClamped(
                original
              );

            expect(
              original.getTime()
            ).toBe(timestamp);

            expect(
              result.getMonth()
            ).toBe(8);

            expect(
              result.getDate()
            ).toBe(30);
          }
        );
      }
    );


    describe(
      'contrato utilizado por la credencial',
      () => {
        const service =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/documentos/documentos.service.ts'
            ),
            'utf8'
          );

        const repository =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/documentos/documentos.repository.ts'
            ),
            'utf8'
          );


        test(
          'la credencial utiliza contrato activo',
          () => {
            const start =
              service.indexOf(
                'export async function generarCredencialImagen('
              );

            const end =
              service.indexOf(
                '// ============================================================\n// COMPATIBILIDAD',
                start
              );

            expect(start).toBeGreaterThan(-1);
            expect(end).toBeGreaterThan(start);

            const credentialBlock =
              service.slice(
                start,
                end
              );

            expect(
              credentialBlock
            ).toContain(
              'findActiveContratoByUser('
            );

            expect(
              credentialBlock
            ).not.toContain(
              'findLatestContratoByUser('
            );
          }
        );


        test(
          'repository exige estado activo',
          () => {
            const start =
              repository.indexOf(
                'export async function findActiveContratoByUser('
              );

            expect(start).toBeGreaterThan(-1);

            const block =
              repository.slice(
                start,
                start + 700
              );

            expect(
              block
            ).toContain(
              "estado = 'activo'"
            );
          }
        );
      }
    );
  }
);
