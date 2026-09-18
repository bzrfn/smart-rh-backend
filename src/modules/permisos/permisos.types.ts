export const MODULOS_PERMITIDOS = [
  'asistencia',
  'contratos',
  'nomina',
  'vacaciones',
] as const;

export type ModuloPermiso =
  (typeof MODULOS_PERMITIDOS)[number];

export type PermisosUsuario =
  Partial<
    Record<
      ModuloPermiso,
      boolean
    >
  >;

export function isModuloPermiso(
  value: string
): value is ModuloPermiso {
  return (
    MODULOS_PERMITIDOS as readonly string[]
  ).includes(value);
}
