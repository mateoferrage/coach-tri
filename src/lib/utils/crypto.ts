import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  // Accepts a 64-char hex string or a 32-char raw string
  if (key.length === 64) return Buffer.from(key, 'hex')
  if (key.length === 32) return Buffer.from(key, 'utf8')
  throw new Error('ENCRYPTION_KEY must be 32 bytes (raw) or 64 hex chars')
}

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptCredential(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid ciphertext format')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
