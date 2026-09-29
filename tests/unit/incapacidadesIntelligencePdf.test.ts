import fs from 'node:fs';


describe(
  'Incapacidades - contrato extractor PDF local',
  () => {
    const source =
      fs.readFileSync(
        'src/modules/incapacidades/incapacidades.intelligence.pdf.ts',
        'utf8'
      );


    test(
      'usa PDF.js con import diferido',
      () => {
        expect(
          source
        ).toContain(
          "'pdfjs-dist/legacy/build/pdf.mjs'"
        );


        expect(
          source
        ).toContain(
          'await import('
        );


        expect(
          source
        ).not.toMatch(
          /import\s*\{[^}]*getDocument[^}]*\}\s*from\s*['"]pdfjs-dist/s
        );
      }
    );


    test(
      'acepta Buffer y no URL',
      () => {
        expect(
          source
        ).toMatch(
          /extractLocalPdfText\(\s*buffer:\s*Buffer/
        );


        expect(
          source
        ).not.toMatch(
          /\burl\s*:/i
        );
      }
    );


    test(
      'no usa filesystem red ni procesos hijos',
      () => {
        expect(
          source
        ).not.toMatch(
          /node:fs|from ['"]fs['"]/i
        );


        expect(
          source
        ).not.toMatch(
          /\bfetch\s*\(|axios|https?:\/\//i
        );


        expect(
          source
        ).not.toMatch(
          /child_process|spawn\s*\(|exec\s*\(/i
        );
      }
    );


    test(
      'no persiste ni registra texto',
      () => {
        expect(
          source
        ).not.toMatch(
          /console\.(log|warn|error)/i
        );


        expect(
          source
        ).not.toMatch(
          /INSERT\s+INTO|UPDATE\s+incapacidad|writeFile|appendFile/i
        );
      }
    );


    test(
      'mantiene límites defensivos',
      () => {
        expect(
          source
        ).toContain(
          'MAX_PDF_PAGES'
        );


        expect(
          source
        ).toContain(
          '20'
        );


        expect(
          source
        ).toContain(
          'MAX_EXTRACTED_CHARACTERS'
        );


        expect(
          source
        ).toContain(
          '100_000'
        );
      }
    );


    test(
      'define error de dominio sanitizado',
      () => {
        expect(
          source
        ).toContain(
          'LocalPdfTextExtractionError'
        );


        expect(
          source
        ).toContain(
          "'PDF_TEXT_EXTRACTION_FAILED'"
        );


        expect(
          source
        ).toContain(
          "'PDF_TOO_MANY_PAGES'"
        );


        expect(
          source
        ).not.toContain(
          'error.message'
        );


        expect(
          source
        ).not.toContain(
          'String(error'
        );
      }
    );


    test(
      'reconstruye líneas usando transform Y',
      () => {
        expect(
          source
        ).toContain(
          'transform?'
        );


        expect(
          source
        ).toContain(
          'readItemY'
        );


        expect(
          source
        ).toContain(
          'LINE_Y_TOLERANCE'
        );


        expect(
          source
        ).toContain(
          'coordinateLineBreak'
        );


        expect(
          source
        ).toMatch(
          /Math\.abs\([\s\S]*currentY[\s\S]*previousY/
        );
      }
    );


    test(
      'limita también el texto final normalizado',
      () => {
        expect(
          source
        ).toContain(
          'normalizedExceededLimit'
        );


        expect(
          source
        ).toMatch(
          /normalizedText\.slice\(\s*0,\s*MAX_EXTRACTED_CHARACTERS\s*\)/
        );


        expect(
          source
        ).toMatch(
          /truncado:\s*truncated\s*\|\|\s*normalizedExceededLimit/
        );
      }
    );
  }
);
