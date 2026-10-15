import { test, expect } from 'claude-code/testing'
import { validatePet, loadPet, timeline, baristaSvg } from '../hooks/ui/Barista'
import { T, palette, isDark, LIGHT, DARK, ansi } from '../hooks/theme'

const KEYS = ['cream', 'milk', 'espresso', 'caramel', 'latte', 'line', 'muted', 'accent', 'danger']
const PETS = ['barista']
const hex = /^#[0-9A-Fa-f]{6}$/

test('palette は light 既定、ダーク指定で DARK', () => {
  expect(Object.keys(T.colors).sort()).toEqual([...KEYS].sort())
  for (const k of KEYS) {
    expect(hex.test((LIGHT as any)[k])).toBe(true)
    expect(hex.test((DARK as any)[k])).toBe(true)
  }
  expect(palette({ e: {} })).toEqual(LIGHT)
  expect(isDark({ e: { colorScheme: 'dark' } })).toBe(true)
  expect(palette({ e: { theme: 'dark-daltonized' } })).toEqual(DARK)
  expect(palette({ e: { theme: 'light' } })).toEqual(LIGHT)
  expect(ansi('danger')).toBe('red')
})

test('pet JSON の構造検証と loadPet', async () => {
  const png = 'iVBORw0KGgo='
  const mk = (n: number) => Array.from({ length: n }, () => png)
  const pet = {
    id: 'barista', name: 'Barista', w: 72, h: 78,
    frames: { idle: mk(6), wave: mk(4), run: mk(6), done: mk(6) },
    durations: { idle: [280, 110, 110, 140, 140, 320], wave: [140, 140, 140, 140], run: mk(6).map(() => 120), done: mk(6).map(() => 150) },
  }
  expect(validatePet(pet)).toBe(null)
  expect(validatePet({ ...pet, frames: { ...pet.frames, wave: mk(3) } })).toBe('frames.wave')
  const $: any = { plugin: { root: '/x' }, fs: { read: async () => JSON.stringify(pet) } }
  expect((await loadPet($, 'barista'))?.id).toBe('barista')
  const bad: any = { plugin: { root: '/x' }, fs: { read: async () => { throw new Error('nope') } } }
  expect(await loadPet(bad, 'barista')).toBe(null)
  expect(timeline(pet as any, 'idle').length).toBe(22)
  const svg = baristaSvg(pet as any, 'idle')
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg.includes('repeatCount="indefinite"')).toBe(true)
})
