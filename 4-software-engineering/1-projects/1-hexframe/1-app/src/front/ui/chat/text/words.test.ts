import { describe, expect, it } from 'vitest'

import { plainOf, weave } from './words'

const projects = { tile: { title: 'Projects' } }
const site = { tile: { title: 'Site' } }

describe('weave', () => {
  it('weaves each tile in where the sentence puts it', () => {
    const english = (inputs: { site: string; projects: string }) =>
      `Move ${inputs.site} into ${inputs.projects}`
    expect(weave(english, { site, projects })).toEqual(['Move ', site, ' into ', projects])
  })

  it('follows a language that names them in the other order', () => {
    const reversed = (inputs: { site: string; projects: string }) =>
      `Into ${inputs.projects}, move ${inputs.site}`
    expect(weave(reversed, { site, projects })).toEqual(['Into ', projects, ', move ', site])
  })

  it('weaves a tile that opens or ends the sentence, with no empty words around it', () => {
    const bare = (inputs: { site: string }) => inputs.site
    expect(weave(bare, { site })).toEqual([site])
  })

  it('leaves a sentence that names no tile as it is', () => {
    expect(weave(() => 'Thinking', {})).toEqual(['Thinking'])
  })

  it('weaves who acted, by name, as a tile', () => {
    const edited = (inputs: { key: string; projects: string }) =>
      `${inputs.key} edited ${inputs.projects}`
    const key = { name: 'Claude Code, laptop' }
    expect(weave(edited, { key, projects })).toEqual([key, ' edited ', projects])
  })
})

describe('plainOf', () => {
  it('reads each tile by its title and each name as it is', () => {
    expect(plainOf(['Move ', site, ' for ', { name: 'a Key' }, '.'])).toBe('Move Site for a Key.')
  })
})
