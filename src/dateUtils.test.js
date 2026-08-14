import { describe, it, expect } from 'vitest';
import { todayISODate, isPastDate, weekRange, isInRange, formatDueLabel, buildCalendarCells } from './dateUtils.js';

describe('todayISODate', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(todayISODate(new Date(2026, 7, 14))).toBe('2026-08-14');
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isPastDate', () => {
  it('is true for a date before today', () => {
    expect(isPastDate('2026-08-13', '2026-08-14')).toBe(true);
  });

  it('is false for today or a future date', () => {
    expect(isPastDate('2026-08-14', '2026-08-14')).toBe(false);
    expect(isPastDate('2026-08-15', '2026-08-14')).toBe(false);
  });
});

describe('weekRange', () => {
  it('returns the Sunday-Saturday window containing the date', () => {
    // 2026-08-14 is a Friday
    expect(weekRange('2026-08-14')).toEqual(['2026-08-09', '2026-08-15']);
  });

  it('handles a Sunday correctly', () => {
    expect(weekRange('2026-08-09')).toEqual(['2026-08-09', '2026-08-15']);
  });
});

describe('isInRange', () => {
  it('includes both endpoints', () => {
    expect(isInRange('2026-08-09', '2026-08-09', '2026-08-15')).toBe(true);
    expect(isInRange('2026-08-15', '2026-08-09', '2026-08-15')).toBe(true);
  });

  it('excludes dates outside the range', () => {
    expect(isInRange('2026-08-08', '2026-08-09', '2026-08-15')).toBe(false);
    expect(isInRange('2026-08-16', '2026-08-09', '2026-08-15')).toBe(false);
  });
});

describe('formatDueLabel', () => {
  it('labels today and tomorrow specially', () => {
    expect(formatDueLabel('2026-08-14', '2026-08-14')).toBe('Due today');
    expect(formatDueLabel('2026-08-15', '2026-08-14')).toBe('Due tomorrow');
  });

  it('formats other dates as month + day', () => {
    expect(formatDueLabel('2026-08-20', '2026-08-14')).toBe('Due Aug 20');
  });
});

describe('buildCalendarCells', () => {
  it('produces leading blanks matching the 1st\'s weekday, and marks today', () => {
    // August 2026: the 1st is a Saturday (day 6)
    const cells = buildCalendarCells(2026, 7, '2026-08-14');
    const blanks = cells.filter((c) => c.label === '');
    expect(blanks.length).toBe(6);
    const dayCells = cells.filter((c) => c.label !== '');
    expect(dayCells.length).toBe(31);
    const today = cells.find((c) => c.dateISO === '2026-08-14');
    expect(today.isToday).toBe(true);
    expect(cells.filter((c) => c.isToday).length).toBe(1);
  });
});
