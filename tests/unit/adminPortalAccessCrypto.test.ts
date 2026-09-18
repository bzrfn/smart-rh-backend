import {
  createAdminAccessCodeHmac,
  createAdminAccessIpHash,
  generateAdminAccessChallengeId,
  generateAdminAccessCode,
  isValidAdminAccessChallengeId,
  isValidAdminAccessCode,
  safeEqualAdminAccessHmac,
} from '../../src/modules/auth/adminAccess.crypto.js';


describe(
  'Admin portal access crypto',
  () => {
    test(
      'genera challenge ids de 256 bits en hexadecimal',
      () => {
        const first =
          generateAdminAccessChallengeId();

        const second =
          generateAdminAccessChallengeId();

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          second
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).not.toBe(
          second
        );

        expect(
          isValidAdminAccessChallengeId(
            first
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'genera codigos de exactamente seis digitos',
      () => {
        for (
          let index = 0;
          index < 50;
          index += 1
        ) {
          const code =
            generateAdminAccessCode();

          expect(
            code
          ).toMatch(
            /^\d{6}$/
          );

          expect(
            isValidAdminAccessCode(
              code
            )
          ).toBe(
            true
          );
        }
      }
    );


    test(
      'HMAC es determinista para challenge y codigo iguales',
      () => {
        const challenge =
          'a'.repeat(
            64
          );

        const first =
          createAdminAccessCodeHmac(
            challenge,
            '123456'
          );

        const second =
          createAdminAccessCodeHmac(
            challenge,
            '123456'
          );

        expect(
          first
        ).toBe(
          second
        );

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );
      }
    );


    test(
      'el mismo codigo produce HMAC distinto con otro challenge',
      () => {
        const first =
          createAdminAccessCodeHmac(
            'a'.repeat(
              64
            ),
            '123456'
          );

        const second =
          createAdminAccessCodeHmac(
            'b'.repeat(
              64
            ),
            '123456'
          );

        expect(
          first
        ).not.toBe(
          second
        );
      }
    );


    test(
      'comparacion segura acepta HMAC igual y rechaza distinto',
      () => {
        const challenge =
          'c'.repeat(
            64
          );

        const first =
          createAdminAccessCodeHmac(
            challenge,
            '111111'
          );

        const second =
          createAdminAccessCodeHmac(
            challenge,
            '222222'
          );

        expect(
          safeEqualAdminAccessHmac(
            first,
            first
          )
        ).toBe(
          true
        );

        expect(
          safeEqualAdminAccessHmac(
            first,
            second
          )
        ).toBe(
          false
        );

        expect(
          safeEqualAdminAccessHmac(
            first,
            'invalido'
          )
        ).toBe(
          false
        );
      }
    );


    test(
      'hash de IP no conserva la IP original',
      () => {
        const ip =
          '192.168.1.100';

        const hash =
          createAdminAccessIpHash(
            ip
          );

        expect(
          hash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          hash
        ).not.toContain(
          ip
        );

        expect(
          createAdminAccessIpHash(
            ''
          )
        ).toBeNull();
      }
    );


    test(
      'rechaza challenge o codigo con formato invalido',
      () => {
        expect(
          () =>
            createAdminAccessCodeHmac(
              'abc',
              '123456'
            )
        ).toThrow(
          'Datos de autorización administrativa inválidos'
        );

        expect(
          () =>
            createAdminAccessCodeHmac(
              'a'.repeat(
                64
              ),
              '12345'
            )
        ).toThrow(
          'Datos de autorización administrativa inválidos'
        );
      }
    );
  }
);
