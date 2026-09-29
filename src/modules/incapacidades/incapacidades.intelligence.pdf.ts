const PDFJS_MODULE =
  'pdfjs-dist/legacy/build/pdf.mjs';

const PDFJS_VERSION =
  '5.4.296' as const;

const MAX_PDF_PAGES =
  20;

const MAX_EXTRACTED_CHARACTERS =
  100_000;

/*
 * Diferencias menores pueden corresponder
 * a ruido flotante o variaciones tipográficas.
 *
 * El diagnóstico sintético confirmó líneas
 * con diferencias de ~12.7 puntos.
 */
const LINE_Y_TOLERANCE =
  1.5;


type PdfJsTextItem = {
  str?:
    unknown;

  transform?:
    unknown;

  hasEOL?:
    unknown;
};


type PdfJsTextContent = {
  items:
    unknown[];
};


type PdfJsPage = {
  getTextContent:
    () => Promise<
      PdfJsTextContent
    >;
};


type PdfJsDocument = {
  numPages:
    number;

  getPage:
    (
      pageNumber:
        number
    ) => Promise<
      PdfJsPage
    >;

  destroy:
    () => Promise<
      void
    >;
};


type PdfJsLoadingTask = {
  promise:
    Promise<
      PdfJsDocument
    >;
};


type PdfJsModule = {
  getDocument:
    (
      options: {
        data:
          Uint8Array;

        isEvalSupported:
          boolean;

        useSystemFonts:
          boolean;

        verbosity:
          number;
      }
    ) => PdfJsLoadingTask;
};


export type LocalPdfTextExtractionResult = {
  texto:
    string;

  paginas:
    number;

  caracteres:
    number;

  tiene_texto:
    boolean;

  truncado:
    boolean;

  proveedor:
    'pdfjs-dist';

  version:
    '5.4.296';
};


export type LocalPdfTextExtractionErrorCode =
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'PDF_TOO_MANY_PAGES';


export class LocalPdfTextExtractionError
  extends Error {
  readonly code:
    LocalPdfTextExtractionErrorCode;


  constructor(
    code:
      LocalPdfTextExtractionErrorCode
  ) {
    super(
      code
    );

    this.name =
      'LocalPdfTextExtractionError';

    this.code =
      code;
  }
}


async function loadPdfJs():
  Promise<
    PdfJsModule
  > {
  /*
   * Import diferido para mantener
   * compatibilidad con Jest actual.
   */
  const loaded =
    await import(
      PDFJS_MODULE
    );


  if (
    typeof loaded.getDocument !==
      'function'
  ) {
    throw new LocalPdfTextExtractionError(
      'PDF_TEXT_EXTRACTION_FAILED'
    );
  }


  return loaded as unknown as
    PdfJsModule;
}


function normalizeTransientText(
  value:
    string
): string {
  return String(
    value || ''
  )
    .normalize(
      'NFKC'
    )
    .replace(
      /\r\n?/g,
      '\n'
    )
    .split(
      '\n'
    )
    .map(
      line =>
        line
          .replace(
            /[ \t]+/g,
            ' '
          )
          .trim()
    )
    .filter(Boolean)
    .join(
      '\n'
    );
}


function readItemY(
  item:
    PdfJsTextItem
): number | null {
  if (
    !Array.isArray(
      item.transform
    ) ||
    item.transform.length <
      6
  ) {
    return null;
  }


  const rawY =
    item.transform[
      5
    ];


  if (
    typeof rawY !==
      'number' ||
    !Number.isFinite(
      rawY
    )
  ) {
    return null;
  }


  return rawY;
}


export async function extractLocalPdfText(
  buffer:
    Buffer
): Promise<
  LocalPdfTextExtractionResult
> {
  /*
   * Entrada exclusivamente en memoria.
   *
   * No URL.
   * No filesystem.
   * No proceso hijo.
   * No red.
   * No logging.
   * No persistencia de texto.
   */
  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length === 0
  ) {
    throw new LocalPdfTextExtractionError(
      'PDF_TEXT_EXTRACTION_FAILED'
    );
  }


  try {
    const pdfjs =
      await loadPdfJs();


    const loadingTask =
      pdfjs.getDocument({
        data:
          new Uint8Array(
            buffer
          ),

        isEvalSupported:
          false,

        useSystemFonts:
          true,

        verbosity:
          0,
      });


    const document =
      await loadingTask.promise;


    try {
      if (
        !Number.isInteger(
          document.numPages
        ) ||
        document.numPages < 1
      ) {
        throw new LocalPdfTextExtractionError(
          'PDF_TEXT_EXTRACTION_FAILED'
        );
      }


      if (
        document.numPages >
        MAX_PDF_PAGES
      ) {
        throw new LocalPdfTextExtractionError(
          'PDF_TOO_MANY_PAGES'
        );
      }


      const pageTexts:
        string[] =
          [];


      let acceptedCharacters =
        0;

      let truncated =
        false;


      for (
        let pageNumber = 1;
        pageNumber <=
          document.numPages;
        pageNumber += 1
      ) {
        const page =
          await document.getPage(
            pageNumber
          );


        const content =
          await page
            .getTextContent();


        const pieces:
          string[] =
            [];


        let previousY:
          number | null =
            null;


        let previousEndedLine =
          false;


        for (
          const rawItem of
            content.items
        ) {
          if (
            !rawItem ||
            typeof rawItem !==
              'object' ||
            !(
              'str'
              in rawItem
            )
          ) {
            continue;
          }


          const item =
            rawItem as
              PdfJsTextItem;


          const value =
            String(
              item.str ??
              ''
            )
              .replace(
                /[ \t]+/g,
                ' '
              )
              .trim();


          if (!value) {
            continue;
          }


          const remaining =
            MAX_EXTRACTED_CHARACTERS -
            acceptedCharacters;


          if (
            remaining <= 0
          ) {
            truncated =
              true;

            break;
          }


          const accepted =
            value.slice(
              0,
              remaining
            );


          const currentY =
            readItemY(
              item
            );


          const coordinateLineBreak =
            pieces.length > 0 &&
            currentY !== null &&
            previousY !== null &&
            Math.abs(
              currentY -
              previousY
            ) >
              LINE_Y_TOLERANCE;


          if (
            pieces.length >
            0
          ) {
            pieces.push(
              previousEndedLine ||
              coordinateLineBreak
                ? '\n'
                : ' '
            );
          }


          pieces.push(
            accepted
          );


          acceptedCharacters +=
            accepted.length;


          previousEndedLine =
            item.hasEOL ===
              true;


          if (
            currentY !== null
          ) {
            previousY =
              currentY;
          }


          if (
            accepted.length <
            value.length
          ) {
            truncated =
              true;

            break;
          }
        }


        if (
          pieces.length >
          0
        ) {
          pageTexts.push(
            pieces.join(
              ''
            )
          );
        }


        if (truncated) {
          break;
        }
      }


      /*
       * NFKC y separadores pueden alterar
       * la longitud final.
       *
       * El límite se vuelve a imponer sobre
       * el resultado realmente retornado.
       */
      const normalizedText =
        normalizeTransientText(
          pageTexts.join(
            '\n'
          )
        );


      const normalizedExceededLimit =
        normalizedText.length >
        MAX_EXTRACTED_CHARACTERS;


      const texto =
        normalizedText.slice(
          0,
          MAX_EXTRACTED_CHARACTERS
        );


      return {
        texto,

        paginas:
          document.numPages,

        caracteres:
          texto.length,

        tiene_texto:
          texto.length > 0,

        truncado:
          truncated ||
          normalizedExceededLimit,

        proveedor:
          'pdfjs-dist',

        version:
          PDFJS_VERSION,
      };

    } finally {
      await document.destroy();
    }

  } catch (error) {
    if (
      error instanceof
      LocalPdfTextExtractionError
    ) {
      throw error;
    }


    /*
     * Nunca exponemos mensajes internos
     * de PDF.js.
     */
    throw new LocalPdfTextExtractionError(
      'PDF_TEXT_EXTRACTION_FAILED'
    );
  }
}
