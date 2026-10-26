import { describe, expect, it } from 'vitest';
import { csvCell, wordsToCsv } from '@/lib/exportData';

describe('CSV export', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it('includes verified and rejected synonyms separately', () => {
    const csv = wordsToCsv([
      { term: 'mitigate', source: 'reading', synonyms: [{ word: 'reduce', verdict: 'fits' }, { word: 'soothe', verdict: 'rejected' }, { word: 'ease', verdict: 'unreviewed' }] },
    ]);
    const [header, row] = csv.split('\r\n');
    const cols = header.split(',');
    const cells = row.split(',');
    expect(cells[cols.indexOf('verified_synonyms')]).toBe('reduce');
    expect(cells[cols.indexOf('rejected_synonyms')]).toBe('soothe');
  });
});
