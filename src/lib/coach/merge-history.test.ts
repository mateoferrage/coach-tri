import { describe, it, expect } from 'vitest'
import { mergeHistory } from './merge-history'

const msg = (id: string, role: 'user' | 'assistant', content: string) => ({ id, role, content })

describe('mergeHistory', () => {
  it("renvoie l'historique tel quel quand rien n'est encore affiché", () => {
    const history = [msg('1', 'user', 'Salut'), msg('2', 'assistant', 'Bonjour')]
    expect(mergeHistory(history, [])).toEqual(history)
  })

  it("garde le message envoyé avant l'arrivée de l'historique", () => {
    const history = [msg('1', 'user', 'Ancien'), msg('2', 'assistant', 'Réponse')]
    const local = [msg('tmp-9', 'user', 'Nouveau')]
    expect(mergeHistory(history, local)).toEqual([...history, ...local])
  })

  it("ne double pas un message déjà enregistré quand l'historique arrive après l'envoi", () => {
    const history = [msg('10', 'user', 'Nouveau'), msg('11', 'assistant', 'OK')]
    const local = [msg('tmp-9', 'user', 'Nouveau'), msg('11', 'assistant', 'OK')]
    expect(mergeHistory(history, local)).toEqual(local)
  })

  it('ne retire pas un ancien message identique à un message déjà confirmé', () => {
    const history = [msg('1', 'user', 'OK ?'), msg('2', 'assistant', 'Oui')]
    const local = [msg('5', 'user', 'OK ?')]
    expect(mergeHistory(history, local)).toEqual([...history, ...local])
  })
})
