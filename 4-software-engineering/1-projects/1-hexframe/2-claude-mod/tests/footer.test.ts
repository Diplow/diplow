import { expect, test } from 'claude-code/testing'
import { footerRows, rowsOf, rowsOfRow } from '../hooks/footer.js'

const keys = [
  { hotkey: 'u', label: 'u up' },
  { hotkey: 'c', label: 'c context' },
  { hotkey: 'p', label: 'p preview' },
  { hotkey: 'r', label: 'r reload' },
]

test('the footer is its lines and the blank row above each one', () => {
  // The controls on one row and the path: two lines, two gaps.
  expect(footerRows(96, { hasClashes: false, controls: keys })).toBe(4)
  expect(footerRows(96, { hasClashes: true, controls: keys })).toBe(6)
  expect(footerRows(96, { problem: 'Broken', hasClashes: true, controls: keys })).toBe(8)
})

test('a problem wraps at its words, and a word wider than a row breaks across rows', () => {
  expect(rowsOf('aaaaa bbbbb ccccc', 10)).toBe(3)
  expect(rowsOf('aaaa bbbb cccc', 9)).toBe(2)
  expect(rowsOf('x'.repeat(25), 10)).toBe(3)
  expect(rowsOf(`ab ${'x'.repeat(25)} cd`, 10)).toBe(4)
})

test('the controls wrap onto as many rows as their drawn width takes', () => {
  expect(rowsOfRow([10, 10, 10], 34, 2)).toBe(1)
  expect(rowsOfRow([10, 10, 10], 25, 2)).toBe(2)
  // A plain Button draws `hotkey: label`, the hotkey and its colon counted.
  const members = [1, 2, 3, 4, 5, 6].map((n) => ({ hotkey: String(n), label: `${n} Leadership` }))
  expect(footerRows(96, { hasClashes: false, controls: [...members, ...keys] })).toBe(5)
})
