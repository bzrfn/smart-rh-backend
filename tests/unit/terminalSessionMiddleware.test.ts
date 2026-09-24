jest.mock(
  '../../src/modules/auth/terminalAccess.token.js',
  () => ({
    TERMINAL_ACCESS_TOKEN_KIND:
      'terminal_attendance_session',

    TERMINAL_ACCESS_TOKEN_ROLE:
      'terminal_asistencia',

    TERMINAL_ACCESS_TOKEN_SCOPE:
      'attendance:kiosk',

    verifyTerminalAccessToken:
      jest.fn(),
  })
);

import {
  verifyTerminalAccessToken,
} from '../../src/modules/auth/terminalAccess.token.js';

import {
  requireTerminalSession,
} from '../../src/middlewares/requireTerminalSession.js';


const verifyMock =
  verifyTerminalAccessToken as
    jest.MockedFunction<
      typeof verifyTerminalAccessToken
    >;


function createResponse() {
  const res: any = {};

  res.status =
    jest.fn(
      () =>
        res
    );

  res.json =
    jest.fn(
      () =>
        res
    );

  return res;
}


describe(
  'Cambio #1 — Middleware exclusivo de sesión terminal',
  () => {
    beforeEach(
      () => {
        verifyMock.mockReset();
      }
    );


    test(
      'acepta Bearer terminal válido y expone únicamente terminalSession',
      () => {
        verifyMock.mockReturnValue({
          kind:
            'terminal_attendance_session',

          role:
            'terminal_asistencia',

          scope:
            'attendance:kiosk',

          terminalId:
            'terminal-recepcion-01',
        });

        const req: any = {
          headers: {
            authorization:
              'Bearer terminal-jwt-valido',
          },
        };

        const res =
          createResponse();

        const next =
          jest.fn();

        requireTerminalSession(
          req,
          res,
          next
        );

        expect(
          verifyMock
        ).toHaveBeenCalledWith(
          'terminal-jwt-valido'
        );

        expect(
          req.terminalSession
        ).toEqual({
          kind:
            'terminal_attendance_session',

          role:
            'terminal_asistencia',

          scope:
            'attendance:kiosk',

          terminalId:
            'terminal-recepcion-01',
        });

        expect(
          req.auth
        ).toBeUndefined();

        expect(
          req.adminAccess
        ).toBeUndefined();

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next
        ).toHaveBeenCalledWith();

        expect(
          res.status
        ).not.toHaveBeenCalled();

        expect(
          res.json
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'sin Bearer no permite continuar',
      () => {
        const req: any = {
          headers: {},
        };

        const res =
          createResponse();

        const next =
          jest.fn();

        requireTerminalSession(
          req,
          res,
          next
        );

        expect(
          verifyMock
        ).not.toHaveBeenCalled();

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next.mock.calls[0]?.[0]
        ).toBeInstanceOf(
          Error
        );

        expect(
          req.terminalSession
        ).toBeUndefined();
      }
    );


    test(
      'Bearer inválido propaga error y no crea sesión',
      () => {
        verifyMock.mockImplementation(
          () => {
            throw new Error(
              'token terminal inválido'
            );
          }
        );

        const req: any = {
          headers: {
            authorization:
              'Bearer token-invalido',
          },
        };

        const res =
          createResponse();

        const next =
          jest.fn();

        requireTerminalSession(
          req,
          res,
          next
        );

        expect(
          verifyMock
        ).toHaveBeenCalledWith(
          'token-invalido'
        );

        expect(
          req.terminalSession
        ).toBeUndefined();

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next.mock.calls[0]?.[0]
        ).toBeInstanceOf(
          Error
        );
      }
    );


    test(
      'no acepta esquemas distintos de Bearer',
      () => {
        const req: any = {
          headers: {
            authorization:
              'Basic terminal-jwt',
          },
        };

        const res =
          createResponse();

        const next =
          jest.fn();

        requireTerminalSession(
          req,
          res,
          next
        );

        expect(
          verifyMock
        ).not.toHaveBeenCalled();

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next.mock.calls[0]?.[0]
        ).toBeInstanceOf(
          Error
        );
      }
    );


    test(
      'middleware depende exclusivamente del verificador terminal',
      () => {
        const fs =
          require(
            'node:fs'
          );

        const path =
          require(
            'node:path'
          );

        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/middlewares/requireTerminalSession.ts'
            ),
            'utf8'
          );

        expect(
          source
        ).toMatch(
          /verifyTerminalAccessToken/
        );

        expect(
          source
        ).not.toMatch(
          /\bauthJwt\b/
        );

        expect(
          source
        ).not.toMatch(
          /requireAdminAccess/
        );

        expect(
          source
        ).not.toMatch(
          /verifyJwt/
        );

        expect(
          source
        ).not.toMatch(
          /verifyAdminAccessToken/
        );
      }
    );


    test(
      'no agrega terminal_asistencia a la autenticación normal',
      () => {
        const fs =
          require(
            'node:fs'
          );

        const path =
          require(
            'node:path'
          );

        const authJwt =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/middlewares/authJwt.ts'
            ),
            'utf8'
          );

        expect(
          authJwt
        ).not.toMatch(
          /terminal_asistencia/
        );

        expect(
          authJwt
        ).not.toMatch(
          /attendance:kiosk/
        );

        expect(
          authJwt
        ).not.toMatch(
          /verifyTerminalAccessToken/
        );
      }
    );
  }
);
