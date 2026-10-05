export const MAX_TRAINING_CASES = [
  {
    prompt: 'Necesito invitar a un nuevo administrador, ¿cómo lo hago paso a paso?',
    expectedCategory: 'Usuarios y permisos',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: 'Quiero agregar un usuario y asignarle permisos, ¿dónde entro?',
    expectedCategory: 'Usuarios y permisos',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: '¿Cómo reviso incapacidades pendientes de un empleado?',
    expectedCategory: 'Incapacidades',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: '¿Cómo apruebo o rechazo una incapacidad desde el portal?',
    expectedCategory: 'Incapacidades',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: '¿Cómo puedo revisar los pendientes de asistencia?',
    expectedCategory: 'Asistencia administrativa',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: 'busca a Brandon Bernal',
    expectedCategory: 'Datos de empleado',
    shouldQueryEmployeeData: true,
  },
  {
    prompt: 'id 21',
    expectedCategory: 'Datos de empleado',
    shouldQueryEmployeeData: true,
  },
  {
    prompt: 'No pude resolverlo, ¿puedes ayudarme a levantar un ticket con este contexto?',
    expectedCategory: 'Soporte',
    shouldQueryEmployeeData: false,
  },
  {
    prompt: '¿Cómo cambio los permisos de un usuario sin afectar su cuenta?',
    expectedCategory: 'Usuarios y permisos',
    shouldQueryEmployeeData: false,
  },
];
