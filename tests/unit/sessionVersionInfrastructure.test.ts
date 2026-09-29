import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


describe(
  'Session version infrastructure',
  () => {
    test(
      'migracion agrega session_version con default 1',
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              'db/migrations/2026_09_19_user_session_version.sql'
            ),
            'utf8'
          );

        expect(
          source
        ).toContain(
          'ALTER TABLE usuarios'
        );

        expect(
          source
        ).toContain(
          'ADD COLUMN session_version'
        );

        expect(
          source
        ).toContain(
          'INT UNSIGNED'
        );

        expect(
          source
        ).toContain(
          'NOT NULL'
        );

        expect(
          source
        ).toContain(
          'DEFAULT 1'
        );
      }
    );
  }
);
