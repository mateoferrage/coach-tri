/** Séquences typiques d'un texte UTF-8 lu comme du latin-1 (« Ã© » pour « é », « Â » devant un signe). */
const MOJIBAKE = /[ÃÂ][\u0080-¿]/

/**
 * Répare un texte Garmin encodé deux fois (UTF-8 relu en latin-1), et seulement celui-là.
 *
 * La bibliothèque Garmin renvoie parfois « MatÃ©o » au lieu de « Matéo ». Réinterpréter
 * systématiquement le texte cassait les noms déjà corrects (« Matéo » devenait « Mat�o ») :
 * on ne corrige donc que si le motif est présent et que le résultat est valide.
 */
export function fixEncoding(s: string | null | undefined): string | null {
  if (!s) return null
  if (!MOJIBAKE.test(s)) return s
  const decoded = Buffer.from(s, 'latin1').toString('utf8')
  return decoded.includes('�') ? s : decoded
}
