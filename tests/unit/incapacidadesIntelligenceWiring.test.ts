import fs from 'node:fs';


describe(
  'Incapacidades inteligentes - wiring determinístico',
  () => {
    const service =
      fs.readFileSync(
        'src/modules/incapacidades/incapacidades.service.ts',
        'utf8'
      );

    const intelligenceRepository =
      fs.readFileSync(
        'src/modules/incapacidades/incapacidades.intelligence.repository.ts',
        'utf8'
      );


    test(
      'analiza el PDF antes de almacenarlo',
      () => {
        const attachIndex =
          service.indexOf(
            'export async function attachIncapacidadComprobante'
          );

        const scope =
          service.slice(
            attachIndex
          );

        const prepareIndex =
          scope.indexOf(
            'prepareIncapacidadProof('
          );

        const analysisIndex =
          scope.indexOf(
            'analyzePdfStructure('
          );

        const storageIndex =
          scope.indexOf(
            'writeStorageObject('
          );

        expect(
          attachIndex
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          prepareIndex
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          analysisIndex
        ).toBeGreaterThan(
          prepareIndex
        );

        expect(
          storageIndex
        ).toBeGreaterThan(
          analysisIndex
        );
      }
    );


    test(
      'clave del comprobante usa SHA y no timestamp',
      () => {
        const attachIndex =
          service.indexOf(
            'export async function attachIncapacidadComprobante'
          );

        const scope =
          service.slice(
            attachIndex
          );

        expect(
          scope
        ).toContain(
          'analysis.sha256.slice(0, 16)'
        );

        expect(
          scope
        ).not.toContain(
          'Date.now()'
        );
      }
    );


    test(
      'repository usa transacción SQL',
      () => {
        expect(
          intelligenceRepository
        ).toMatch(
          /connection\s*\.\s*beginTransaction\(\)/
        );

        expect(
          intelligenceRepository
        ).toMatch(
          /connection\s*\.\s*commit\(\)/
        );

        expect(
          intelligenceRepository
        ).toMatch(
          /connection\s*\.\s*rollback\(\)/
        );

        expect(
          intelligenceRepository
        ).toMatch(
          /connection\s*\.\s*release\(\)/
        );
      }
    );


    test(
      'preserva ownership estado pendiente y ausencia de comprobante',
      () => {
        expect(
          intelligenceRepository
        ).toContain(
          'AND usuario_id = ?'
        );

        expect(
          intelligenceRepository
        ).toContain(
          "AND estado = 'pendiente'"
        );

        expect(
          intelligenceRepository
        ).toContain(
          'AND comprobante_key IS NULL'
        );
      }
    );


    test(
      'busca documentos con SHA idéntico',
      () => {
        expect(
          intelligenceRepository
        ).toContain(
          'WHERE documento_sha256 = ?'
        );

        expect(
          intelligenceRepository
        ).toContain(
          'FOR UPDATE'
        );

        expect(
          intelligenceRepository
        ).toContain(
          'duplicado_detectado'
        );

        expect(
          intelligenceRepository
        ).toContain(
          'duplicado_de_incapacidad_id'
        );
      }
    );


    test(
      'duplicados o estructura dudosa pasan a revisión',
      () => {
        expect(
          intelligenceRepository
        ).toMatch(
          /duplicateDetected[\s\S]*analysis\.structureStatus\s*!==[\s\S]*'valido'[\s\S]*'requiere_revision'/
        );
      }
    );


    test(
      'no hay aprobación ni rechazo automáticos',
      () => {
        expect(
          intelligenceRepository
        ).not.toMatch(
          /auto_aprobad|auto_rechazad/i
        );
      }
    );


    test(
      'análisis permanece local',
      () => {
        expect(
          intelligenceRepository
        ).toContain(
          "'local-deterministico'"
        );

        expect(
          service
        ).not.toMatch(
          /openai|anthropic|gemini|textract|google.?vision|azure.?vision/i
        );

        expect(
          intelligenceRepository
        ).not.toMatch(
          /openai|anthropic|gemini|textract|google.?vision|azure.?vision/i
        );
      }
    );


    test(
      'no loguea contenido del comprobante',
      () => {
        const attachIndex =
          service.indexOf(
            'export async function attachIncapacidadComprobante'
          );

        const scope =
          service.slice(
            attachIndex
          );

        expect(
          scope
        ).not.toMatch(
          /console\.(log|warn|error)\s*\([^)]*(base64|proof\.buffer)/i
        );
      }
    );
  }
);
