/** Préfixe des identifiants donnés aux messages affichés avant la réponse du serveur. */
export const TEMP_ID_PREFIX = 'tmp-'

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/**
 * Fusionne l'historique chargé depuis le serveur avec les messages déjà affichés.
 *
 * L'historique peut arriver après un premier envoi : le remplacer effacerait le message
 * que l'utilisateur vient d'écrire. On garde donc les messages locaux et on place avant eux
 * les messages de l'historique qui ne sont pas déjà affichés, ni sous leur identifiant,
 * ni sous la forme d'un message provisoire de même contenu.
 */
export function mergeHistory<T extends ChatEntry>(history: T[], local: T[]): T[] {
  if (local.length === 0) return history

  const localIds = new Set(local.map((m) => m.id))
  const pendingContents = new Set(
    local.filter((m) => m.id.startsWith(TEMP_ID_PREFIX)).map((m) => m.content),
  )

  const older = history.filter(
    (m) => !localIds.has(m.id) && !(m.role === 'user' && pendingContents.has(m.content)),
  )
  return [...older, ...local]
}
