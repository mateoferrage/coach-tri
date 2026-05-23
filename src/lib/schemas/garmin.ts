import { z } from 'zod'

export const GarminCredentialsSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export type GarminCredentials = z.infer<typeof GarminCredentialsSchema>
