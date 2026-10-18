import { describe, expect, it } from 'vitest'

import { groupPicked, groupsOffered } from './groups'
import { shareRowsOf } from './rows'

// The groups the share widget offers, as they word IAM's: by Organization, its Members first, each
// said shared already where a row names it, and whom a pick names.

const atelier = { id: '00000000-0000-4000-8000-0000000a7e11', title: 'Atelier', preview: '' }
const design = '00000000-0000-4000-8000-00000000d351'
const ops = '00000000-0000-4000-8000-0000000000a5'
const shareable = [
  {
    star: atelier,
    groups: [
      { id: design, name: 'Design' },
      { id: ops, name: 'Ops' },
    ],
  },
]

const around = { tile: 'plans', star: 'ana', titleOf: () => undefined }

/** Plans, shared with Atelier's Members and with its Design group. */
const rows = shareRowsOf(
  {
    everyone: { subject: { _tag: 'Everyone' }, value: 'none', from: null },
    others: [
      {
        subject: { _tag: 'Group', id: 'atelier' },
        value: 'read',
        from: 'plans',
        star: atelier,
      },
      {
        subject: { _tag: 'Group', id: design },
        value: 'read+write',
        from: 'plans',
        star: undefined,
        group: { name: 'Design', organization: atelier },
      },
    ],
  },
  around,
)

describe('the groups the share widget offers', () => {
  it('list each Organization’s Members, then its own, those shared already said so', () => {
    const [offered] = groupsOffered(shareable, rows).organizations
    expect(offered?.name).toBe('Atelier')
    expect(offered?.groups.map(({ name, named }) => ({ name, named }))).toEqual([
      { name: 'Members', named: true },
      { name: 'Design', named: true },
      { name: 'Ops', named: false },
    ])
  })

  it('name the Members by their star, a Group by its id, nothing offered by nothing', () => {
    const offered = groupsOffered(shareable, rows)
    const [members, , opss] = offered.organizations[0]?.groups ?? []
    expect(groupPicked(offered, 'plans', members?.key ?? '')).toEqual({
      tile: 'plans',
      subject: { _tag: 'Account', star: atelier.id },
      value: 'read',
    })
    expect(groupPicked(offered, 'plans', opss?.key ?? '')?.subject).toEqual({
      _tag: 'Group',
      id: ops,
    })
    expect(groupPicked(offered, 'plans', 'members')).toBeUndefined()
  })
})
