import { describe, expect, test } from "bun:test";
import { parseAbsoluteDate, parseDate, parseRelativeDate } from "../src/index.ts";

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0); // 2026-11-14T12:00Z
const H = 3600_000;
const D = 24 * H;

describe("parseRelativeDate", () => {
  test.each([
    ["just now", NOW],
    ["5 minutes ago", NOW - 5 * 60_000],
    ["5 mins ago", NOW - 5 * 60_000],
    ["5m ago", NOW - 5 * 60_000],
    ["an hour ago", NOW - H],
    ["3 hours ago", NOW - 3 * H],
    ["3h ago", NOW - 3 * H],
    ["about 2 days ago", NOW - 2 * D],
    ["yesterday", NOW - D],
    ["2 weeks ago", NOW - 14 * D],
    ["  4 Days Ago ", NOW - 4 * D],
    ["hace 2 días", NOW - 2 * D],
    ["hace 2 dias", NOW - 2 * D],
    ["hace un día", NOW - D],
    ["hace 3 horas", NOW - 3 * H],
    ["hace 1 semana", NOW - 7 * D],
    ["ayer", NOW - D],
    ["hoy", NOW],
    ["7 days", NOW - 7 * D],
  ])("%p", (text, want) => {
    expect(parseRelativeDate(text, NOW)).toBe(want);
  });

  test("months and years step the calendar, not a fixed length", () => {
    expect(parseRelativeDate("1 month ago", NOW)).toBe(Date.UTC(2026, 9, 14, 12));
    expect(parseRelativeDate("hace 2 años", NOW)).toBe(Date.UTC(2024, 10, 14, 12));
  });

  test("not relative dates", () => {
    for (const t of ["", "Nov 14, 2026", "Chapter 5", "5m", "hace", "3 bananas ago"]) {
      expect(parseRelativeDate(t, NOW)).toBeUndefined();
    }
  });
});

describe("parseAbsoluteDate", () => {
  const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
  test.each([
    ["Nov 14, 2026", day(2026, 11, 14)],
    ["November 14 2026", day(2026, 11, 14)],
    ["Sept. 3, 2025", day(2025, 9, 3)],
    ["March 1st, 2024", day(2024, 3, 1)],
    ["14 Nov 2026", day(2026, 11, 14)],
    ["14 de noviembre de 2026", day(2026, 11, 14)],
    ["3 de agosto del 2025", day(2025, 8, 3)],
    ["2026-11-14", day(2026, 11, 14)],
    ["2026/1/5", day(2026, 1, 5)],
  ])("%p", (text, want) => {
    expect(parseAbsoluteDate(text)).toBe(want);
  });

  test("ISO timestamps keep their time", () => {
    expect(parseAbsoluteDate("2026-11-14T08:30:00Z")).toBe(Date.UTC(2026, 10, 14, 8, 30));
  });

  test("numeric day/month needs an order", () => {
    expect(parseAbsoluteDate("03/04/2026")).toBeUndefined();
    expect(parseAbsoluteDate("03/04/2026", { order: "mdy" })).toBe(day(2026, 3, 4));
    expect(parseAbsoluteDate("03/04/2026", { order: "dmy" })).toBe(day(2026, 4, 3));
  });

  test("impossible dates are rejected", () => {
    expect(parseAbsoluteDate("Feb 31, 2026")).toBeUndefined();
    expect(parseAbsoluteDate("Smarch 1, 2026")).toBeUndefined();
  });
});

test("parseDate tries relative, then absolute", () => {
  expect(parseDate("2 hours ago", { now: NOW })).toBe(NOW - 2 * H);
  expect(parseDate("Nov 1, 2026", { now: NOW })).toBe(Date.UTC(2026, 10, 1));
  expect(parseDate("soon", { now: NOW })).toBeUndefined();
});
