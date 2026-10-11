// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { themeScript, useThemeState } from './theme'

const root = document.documentElement

function prefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
  }))
}

function runThemeScript() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the script under test ships as a string inlined in <head>; evaluating it is the test
  new Function(themeScript)()
}

function blockStorage() {
  const blocked = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  root.classList.remove('dark')
  localStorage.clear()
})

describe('themeScript', () => {
  it('paints dark when nothing is stored', () => {
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('stays dark when the system prefers light but the user chose nothing', () => {
    prefersDark(false)
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('treats an unknown stored value as no choice', () => {
    localStorage.setItem('hexframe.theme', 'auto')
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('still paints dark when storage is blocked', () => {
    blockStorage()
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('applies a stored light choice, whatever the system prefers', () => {
    prefersDark(true)
    localStorage.setItem('hexframe.theme', 'light')
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('applies a stored dark choice', () => {
    localStorage.setItem('hexframe.theme', 'dark')
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })
})

describe('useThemeState', () => {
  it('reads the theme the page was painted with', () => {
    root.classList.add('dark')
    const { result } = renderHook(() => useThemeState())
    expect(result.current.state.theme).toBe('dark')
  })

  it('toggles the theme and keeps the choice for the next visit', () => {
    const { result } = renderHook(() => useThemeState())
    act(() => {
      result.current.actions.toggle()
    })
    expect(result.current.state.theme).toBe('dark')
    expect(root.classList.contains('dark')).toBe(true)

    root.classList.remove('dark')
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)

    act(() => {
      result.current.actions.toggle()
    })
    expect(result.current.state.theme).toBe('light')
    expect(localStorage.getItem('hexframe.theme')).toBe('light')
  })

  it('still toggles when storage is blocked', () => {
    blockStorage()
    const { result } = renderHook(() => useThemeState())
    act(() => {
      result.current.actions.toggle()
    })
    expect(result.current.state.theme).toBe('dark')
    expect(root.classList.contains('dark')).toBe(true)
  })
})
