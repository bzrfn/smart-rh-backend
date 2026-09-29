import {
  RowDataPacket,
} from 'mysql2/promise';

import {
  pool,
} from '../../config/db.js';


export type EligibleTerminalApprover = {
  id: number;
  correo: string;
};


type EligibleTerminalApproverRow =
  RowDataPacket & {
    id: number;
    correo: string;
  };


export async function findEligibleTerminalApproverById(
  userIdInput:
    number
): Promise<EligibleTerminalApprover | null> {
  const userId =
    Number(
      userIdInput
    );

  if (
    !Number.isInteger(
      userId
    ) ||
    userId <= 0
  ) {
    return null;
  }

  const [
    rows,
  ] =
    await pool.query<
      EligibleTerminalApproverRow[]
    >(
      `
        SELECT
          u.id,
          u.correo

        FROM usuarios u

        INNER JOIN roles r
          ON r.id = u.rol_id

        WHERE
          u.id = ?

          AND u.activo = 1

          AND COALESCE(
            u.email_verificado,
            0
          ) = 1

          AND LOWER(
            TRIM(
              r.nombre
            )
          ) = 'admin'

        LIMIT 1
      `,
      [
        userId,
      ]
    );

  const row =
    rows[0];

  if (!row) {
    return null;
  }

  return {
    id:
      Number(
        row.id
      ),

    correo:
      String(
        row.correo ||
        ''
      ).trim(),
  };
}
