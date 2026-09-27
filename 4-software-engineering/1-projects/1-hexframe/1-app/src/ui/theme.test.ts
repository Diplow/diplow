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
  it('follows the system preference when nothing is stored', () => {
    prefersDark(true)
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('stays light when nothing is stored and the system prefers light', () => {
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('treats an unknown stored value as no choice', () => {
    prefersDark(true)
    localStorage.setItem('hexframe.theme', 'auto')
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('still follows the system preference when storage is blocked', () => {
    prefersDark(true)
    blockStorage()
    runThemeScript()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('lets a stored choice win over the system preference', () => {
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
