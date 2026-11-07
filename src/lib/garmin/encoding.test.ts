import { describe, it, expect } from 'vitest'
import { fixEncoding } from './encoding'

describe('fixEncoding', () => {
  it('laisse intact un nom déjà correct', () => {
    expect(fixEncoding('Matéo')).toBe('Matéo')
    expect(fixEncoding('Zoë Lefèvre')).toBe('Zoë Lefèvre')
  })

  it('répare un nom encodé deux fois', () => {
    expect(fixEncoding('MatÃ©o')).toBe('Matéo')
    expect(fixEncoding('LefÃ¨vre')).toBe('Lefèvre')
  })

  it('laisse intact un texte ASCII', () => {
    expect(fixEncoding('Mateo')).toBe('Mateo')
  })

  it('renvoie null pour une valeur vide', () => {
    expect(fixEncoding(null)).toBeNull()
    expect(fixEncoding(undefined)).toBeNull()
    expect(fixEncoding('')).toBeNull()
  })
})
