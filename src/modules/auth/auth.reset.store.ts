type ResetEntry = {
  userId: number;
  correo: string;
  expiresAt: number;
};

const RESET_TTL_MS = 15 * 60 * 1000;

const store = new Map<string, ResetEntry>();

function generarCodigoReset() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createResetToken(data: { userId: number; correo: string }) {
  const token = generarCodigoReset();

  store.set(token, {
    userId: data.userId,
    correo: data.correo,
    expiresAt: Date.now() + RESET_TTL_MS,
  });

  return {
    token,
    expiresInMinutes: 15,
  };
}

export function consumeResetToken(token: string) {
  const entry = store.get(token);

  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }

  store.delete(token);
  return entry;
}