import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/core/config.js';
import { applySuggestion, sniffParse, suggestionLines } from '../../src/core/sniff.js';

const sample = () =>
  readFileSync(new URL('../../data/sample-bank-report.csv', import.meta.url), 'utf8');

const english = [
  'Account report',
  'Booking date,Value date,Type,Description,Debit,Credit',
  '2026-01-02,2026-01-02,Salary,Payroll Example Corp,,1500.00',
  '2026-01-04,2026-01-04,Transfer,Paid to Sample Landlord,420.00,',
  '2026-01-09,2026-01-09,Card,Paid to Demo Cafe,19.90,',
].join('\n');

const italian = [
  'Registrazione;Valuta;Causale;Descrizione;Dare;Avere',
  '15/01/2026;15/01/2026;Bonifico;Stipendio Esempio;;1.500,00',
  '20/01/2026;20/01/2026;Carta;Spesa Mercato Demo;19,90;',
].join('\n');

describe('sniffParse (IMP-3)', () => {
  it('suggests the layout of a comma file with debit and credit columns', () => {
    const s = sniffParse(english);
    expect(s).toMatchObject({ delim: ',', decimal: '.', dateFmt: 'ymd' });
    expect(s.cols).toEqual({
      date: 'Booking date',
      value: 'Value date',
      causale: 'Type',
      desc: 'Description',
      out: 'Debit',
      in: 'Credit',
      amount: '',
    });
  });

  it('suggests semicolons, decimal commas and day-first dates', () => {
    const s = sniffParse(italian);
    expect(s).toMatchObject({ delim: ';', decimal: ',', dateFmt: 'dmy' });
    expect(s.cols).toMatchObject({
      date: 'Registrazione',
      value: 'Valuta',
      desc: 'Descrizione',
      out: 'Dare',
      in: 'Avere',
    });
  });

  it('reads tab-separated text', () => {
    const s = sniffParse(english.replaceAll(',', '\t'));
    expect(s.delim).toBe('\t');
  });

  it('suggests month-first dates when the second number is above 12', () => {
    const text = 'Date,Amount,Description\n01/25/2026,10.00,A\n02/03/2026,-5.00,B\n';
    const s = sniffParse(text);
    expect(s.dateFmt).toBe('mdy');
    expect(s.cols).toMatchObject({
      date: 'Date',
      amount: 'Amount',
      desc: 'Description',
      out: '',
      in: '',
    });
  });

  it('leaves a date format out when it cannot be told', () => {
    const text = 'Date,Amount,Description\n01/02/2026,10.00,A\n03/04/2026,-5.00,B\n';
    expect(sniffParse(text).dateFmt).toBeUndefined();
  });

  it('suggests only what it can tell from an empty or unreadable file', () => {
    expect(sniffParse('')).toEqual({});
    expect(sniffParse('just one line')).toEqual({});
  });

  it('works on the sample statement and its suggestion validates', () => {
    const s = sniffParse(sample());
    const config = defaultConfig();
    expect(s.delim).toBe(config.parse.delim);
    expect(s.decimal).toBe(config.parse.decimal);
    expect(s.dateFmt).toBe(config.parse.dateFmt);
    expect(s.cols).toEqual(expect.objectContaining({ date: 'Booking date', desc: 'Description' }));
  });
});

describe('suggestionLines (IMP-3)', () => {
  it('describes each suggestion in words and marks those that differ from the current settings', () => {
    const lines = suggestionLines(sniffParse(italian), defaultConfig().parse);
    expect(lines).toEqual(
      expect.arrayContaining([
        { key: 'delim', label: 'Delimiter', value: 'semicolon (;)', changed: true },
        { key: 'decimal', label: 'Decimal separator', value: 'comma (,)', changed: true },
        { key: 'dateFmt', label: 'Date format', value: 'day/month/year', changed: true },
      ]),
    );
  });

  it('reports no change when the settings already match', () => {
    const lines = suggestionLines(sniffParse(english), defaultConfig().parse);
    expect(lines.every(l => !l.changed)).toBe(true);
  });
});

describe('applySuggestion (IMP-3)', () => {
  it('returns new settings with the suggestion applied and leaves the input alone', () => {
    const current = defaultConfig().parse;
    const next = applySuggestion(current, sniffParse(italian));
    expect(next).toMatchObject({ delim: ';', decimal: ',', dateFmt: 'dmy' });
    expect(next.cols.date).toBe('Registrazione');
    expect(next.openingRe).toBe(current.openingRe);
    expect(current.delim).toBe(',');
    expect(current.cols.date).toBe('Booking date');
  });
});
