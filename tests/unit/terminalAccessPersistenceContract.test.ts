import fs from 'node:fs';
import path from 'node:path';

const root =
  process.cwd();

const migrationPath =
  'db/migrations/2026_09_23_terminal_access_challenges.sql';

const repositoryPath =
  'src/modules/auth/terminalAccess.repository.ts';

function absolute(
  relativePath: string
) {
  return path.join(
    root,
    relativePath
  );
}

function exists(
  relativePath: string
) {
  return fs.existsSync(
    absolute(relativePath)
  );
}

function read(
  relativePath: string
) {
  if (!exists(relativePath)) {
    return '';
  }

  return fs.readFileSync(
    absolute(relativePath),
    'utf8'
  );
}

function compact(
  source: string
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    )
    .replace(
      /--.*$/gm,
      ''
    )
    .replace(
      /^[ \t]*\/\/.*$/gm,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

describe(
  'Cambio #1 — Persistencia de autorización de terminal',
  () => {
    test(
      'debe existir una migración exclusiva para terminal_access_challenges',
      () => {
        expect(
          exists(migrationPath)
        ).toBe(true);

        const sql =
          compact(
            read(migrationPath)
          );

        expect(sql).toMatch(
          /CREATE TABLE IF NOT EXISTS terminal_access_challenges/i
        );
      }
    );

    test(
      'la autorización identifica challenge y terminal sin convertirla en usuario',
      () => {
        const sql =
          compact(
            read(migrationPath)
          );

        expect(sql).toMatch(
          /challenge_id CHAR\(64\) NOT NULL/i
        );

        expect(sql).toMatch(
          /terminal_id CHAR\(64\) NOT NULL/i
        );

        expect(sql).not.toMatch(
          /terminal_user_id/i
        );

        expect(sql).not.toMatch(
          /rol_id/i
        );
      }
    );

    test(
      'la solicitud conserva estado, expiración y trazabilidad administrativa',
      () => {
        const sql =
          compact(
            read(migrationPath)
          );

        expect(sql).toMatch(
          /status ENUM\([^)]*'pending'[^)]*'approved'[^)]*'rejected'[^)]*'consumed'[^)]*\)/i
        );

        expect(sql).toMatch(
          /DEFAULT 'pending'/i
        );

        expect(sql).toMatch(
          /decision_admin_user_id INT\(11\) DEFAULT NULL/i
        );

        expect(sql).toMatch(
          /request_ip_hash CHAR\(64\) DEFAULT NULL/i
        );

        expect(sql).toMatch(
          /expires_at DATETIME NOT NULL/i
        );

        expect(sql).toMatch(
          /decided_at DATETIME DEFAULT NULL/i
        );

        expect(sql).toMatch(
          /used_at DATETIME DEFAULT NULL/i
        );

        expect(sql).toMatch(
          /created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP/i
        );
      }
    );

    test(
      'la decisión administrativa mantiene una FK durable hacia usuarios',
      () => {
        const sql =
          compact(
            read(migrationPath)
          );

        expect(sql).toMatch(
          /FOREIGN KEY \(decision_admin_user_id\) REFERENCES usuarios \(id\) ON DELETE RESTRICT/i
        );
      }
    );

    test(
      'debe existir repository exclusivo del flujo terminal',
      () => {
        expect(
          exists(repositoryPath)
        ).toBe(true);

        const repository =
          compact(
            read(repositoryPath)
          );

        expect(repository).not.toMatch(
          /adminAccess\.repository/
        );

        expect(repository).not.toMatch(
          /admin_access_challenges/
        );
      }
    );

    test(
      'repository debe soportar creación, consulta, decisión y consumo',
      () => {
        const repository =
          read(repositoryPath);

        expect(repository).toMatch(
          /export async function createTerminalAccessChallenge/
        );

        expect(repository).toMatch(
          /export async function findTerminalAccessStatus/
        );

        expect(repository).toMatch(
          /export async function decideTerminalAccessChallenge/
        );

        expect(repository).toMatch(
          /export async function consumeApprovedTerminalAccessChallenge/
        );

        expect(repository).toMatch(
          /export async function countRecentTerminalAccessRequests/
        );
      }
    );

    test(
      'el consumo de una aprobación debe ser atómico',
      () => {
        const repository =
          compact(
            read(repositoryPath)
          );

        expect(repository).toMatch(
          /getConnection\(\)/
        );

        expect(repository).toMatch(
          /beginTransaction\(\)/
        );

        expect(repository).toMatch(
          /FOR UPDATE/i
        );

        expect(repository).toMatch(
          /commit\(\)/
        );

        expect(repository).toMatch(
          /rollback\(\)/
        );

        expect(repository).toMatch(
          /release\(\)/
        );
      }
    );

    test(
      'un challenge solo puede consumirse si está aprobado, vigente y no usado',
      () => {
        const repository =
          compact(
            read(repositoryPath)
          );

        expect(repository).toMatch(
          /status[^;]*approved/i
        );

        expect(repository).toMatch(
          /expires_at[^;]*NOW\(\)/i
        );

        expect(repository).toMatch(
          /used_at IS NULL/i
        );
      }
    );
  }
);
