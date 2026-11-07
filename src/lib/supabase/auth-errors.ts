/** Messages en français pour les codes d'erreur de Supabase Auth affichés à l'utilisateur. */
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: 'Confirme ton e-mail avant de te connecter.',
  user_already_exists: 'Un compte existe déjà avec cet e-mail.',
  email_exists: 'Un compte existe déjà avec cet e-mail.',
  weak_password: 'Mot de passe trop faible : 6 caractères minimum.',
  over_request_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
  over_email_send_rate_limit: "Trop d'e-mails envoyés. Réessaie dans quelques minutes.",
}

/** Repli sur le texte quand l'erreur n'a pas de code (anciennes versions de l'API). */
const BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already registered/i, BY_CODE.user_already_exists],
  [/password should be/i, BY_CODE.weak_password],
  [/rate limit/i, BY_CODE.over_request_rate_limit],
]

export const AUTH_FALLBACK_MESSAGE = 'Une erreur est survenue. Réessaie.'

/** Traduit une erreur de connexion ou d'inscription ; ne renvoie jamais le texte anglais brut. */
export function authErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return AUTH_FALLBACK_MESSAGE
  const { code, message } = err as { code?: unknown; message?: unknown }
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]
  if (typeof message === 'string') {
    const match = BY_MESSAGE.find(([re]) => re.test(message))
    if (match) return match[1]
  }
  return AUTH_FALLBACK_MESSAGE
}
