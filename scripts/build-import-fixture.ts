/**
 * Construit le fichier de TEST d'import (A7 §4) : ce à quoi ressemble vraiment le
 * fichier d'un syndic marocain, PAS un jeu de test propre. En-têtes approximatifs et
 * dans le désordre, accents et caractères arabes, téléphones hétérogènes (+33, 0033,
 * 06 espacé), montants « 650 » / « 650,00 » / « 1 200,00 », cellules vides, une ligne
 * entièrement vide au milieu, et des lignes défectueuses à rejeter.
 *
 *     npx tsx scripts/build-import-fixture.ts
 *
 * Écrit fixtures/import-lots-test.xlsx (versionné, importé réellement à la vérif).
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// En-têtes VOLONTAIREMENT approximatifs et dans un ordre inattendu.
const HEADERS = [
  'Nom du proprietaire',
  'REF.',
  'Type',
  'Email proprio',
  'Tel proprietaire',
  'Pays proprietaire',
  'Langue proprietaire',
  'Charges',
  'Quote part',
  'Etage',
  'Surface',
  'Occupation',
  'Locataire',
  'Email locataire',
  'Tel locataire',
  'Charges deleguees',
];

type Row = Record<string, string>;
const rows: Row[] = [];
const r = (o: Partial<Row>): void => {
  rows.push(HEADERS.reduce((acc, h) => ({ ...acc, [h]: o[h] ?? '' }), {} as Row));
};

const phones = [
  '+212 6 12 34 56 78',
  '0033 6 11 22 33 44',
  '06 12 34 56 78',
  '+33 6 98 76 54 32',
  '0612345678',
];
const amounts = ['650', '650,00', '1 200,00', '800', '1 250,50', '', '900,00'];
const types = ['Appartement', 'appt', 'Villa', 'شقة', ''];
const countries = ['France', 'Pays-Bas', 'Maroc', 'Belgique', 'هولندا'];
const langs = ['fr', 'ar', 'Arabe', 'Français', ''];
const occ = ['Loué', 'Vacant', 'Occupé par le propriétaire', '', 'loue'];
const owners = [
  'Youssef Chraibi',
  'Fatima Zahra El Amrani',
  'سعاد بنكيران',
  'محمد الفاسي',
  'Jean Dupont',
  'Karim Benjelloun',
  'أمينة التازي',
  'Sophie Martin',
];

// ~50 lignes valides variées.
let n = 0;
for (let f = 1; f <= 5; f++) {
  for (let u = 1; u <= 10; u++) {
    n++;
    const ref = `${String.fromCharCode(64 + f)}${u}`; // A1..E10
    const withTenant = n % 4 === 0;
    r({
      'REF.': ref,
      Type: types[n % types.length]!,
      'Nom du proprietaire': owners[n % owners.length]!,
      'Email proprio': n % 3 === 0 ? '' : `owner${n}@example.ma`,
      'Tel proprietaire': phones[n % phones.length]!,
      'Pays proprietaire': countries[n % countries.length]!,
      'Langue proprietaire': langs[n % langs.length]!,
      Charges: amounts[n % amounts.length]!,
      'Quote part': n % 6 === 0 ? '' : String(10 + (n % 25)),
      Etage: String(f),
      Surface: n % 5 === 0 ? '' : String(60 + (n % 40)),
      Occupation: occ[n % occ.length]!,
      Locataire: withTenant ? 'Hind Alaoui' : '',
      'Email locataire': withTenant ? `tenant${n}@example.ma` : '',
      'Tel locataire': withTenant ? phones[(n + 2) % phones.length]! : '',
      'Charges deleguees': withTenant && n % 8 === 0 ? 'oui' : '',
    });
  }
}

// Cas MRE : le MÊME propriétaire (même e-mail) sur deux lots → une seule personne.
r({
  'REF.': 'MRE1',
  'Nom du proprietaire': 'Nadia Ouazzani',
  'Email proprio': 'nadia.ouazzani@example.ma',
  Type: 'Appartement',
  Charges: '750,00',
  'Quote part': '20',
});
r({
  'REF.': 'MRE2',
  'Nom du proprietaire': 'Nadia Ouazzani',
  'Email proprio': 'nadia.ouazzani@example.ma',
  Type: 'Villa',
  Charges: '1 500,00',
  'Quote part': '35',
});

// Ligne ENTIÈREMENT vide au milieu (doit être ignorée).
r({});

// Lignes DÉFECTUEUSES (doivent apparaître « rejetées » avec le bon motif).
// Références Z* hors de la grille A1..E10 pour cibler le vrai motif (pas un doublon).
r({ 'REF.': 'A1', 'Nom du proprietaire': 'Doublon', Type: 'Appartement' }); // doublon de A1
r({ 'REF.': 'Z1', Locataire: 'Locataire Orphelin', 'Email locataire': 'loc@example.ma' }); // locataire sans proprio
r({ 'REF.': 'Z2', 'Nom du proprietaire': 'Ali Test', Charges: 'à définir' }); // montant illisible
r({ 'REF.': 'Z3', 'Nom du proprietaire': 'Sara Test', 'Quote part': '0' }); // quote-part invalide
r({ 'REF.': 'Z4', 'Nom du proprietaire': 'Omar Test', 'Email proprio': 'pas-un-email' }); // e-mail mal formé
r({ 'REF.': 'Z5', 'Nom du proprietaire': 'Leila Test', Type: 'Garage' }); // type inconnu
r({ 'Nom du proprietaire': 'Sans Reference' }); // référence manquante

async function main(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lots');
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(HEADERS.map((h) => row[h] ?? ''));
  ws.getRow(1).font = { bold: true };

  const dir = join(process.cwd(), 'fixtures');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'import-lots-test.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`écrit ${out} — ${rows.length} lignes (dont 1 vide + 7 défectueuses)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
