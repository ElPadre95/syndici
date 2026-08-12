/**
 * Modèle d'import téléchargeable (A7), localisé (fr/ar) : en-têtes attendus + une
 * ligne d'exemple. Un syndic part de ce fichier plutôt que de deviner le format.
 */
import { getTranslations } from 'next-intl/server';
import { buildTemplateBuffer, TEMPLATE_COLUMNS } from '@/server/import/template';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'lots.import' });

  const headers = TEMPLATE_COLUMNS.map((c) => t(`columns.${c}`));
  const example = TEMPLATE_COLUMNS.map((c) => t(`example.${c}`));
  const buf = await buildTemplateBuffer(headers, example, t('sheetName'));

  const asciiName = 'modele-import-lots.xlsx';
  const utf8Name = encodeURIComponent(`${t('templateFilename')}.xlsx`);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'no-store',
    },
  });
}
