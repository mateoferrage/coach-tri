'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  connected: boolean
  lastSyncAt: string | null
}

const MINT = 'oklch(0.843 0.165 157)'
const DARK = 'oklch(0.116 0.022 155)'

export function GarminConnectCard({ connected: initialConnected, lastSyncAt: initialLastSync }: Props) {
  const router = useRouter()
  const [connected, setConnected]   = useState(initialConnected)
  const [lastSync, setLastSync]     = useState(initialLastSync)
  const [loading, setLoading]       = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')

  /* ── Connect ────────────────────────────────────────────────────────────── */
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading('connect')
    try {
      const res = await fetch('/api/garmin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setConnected(true)
      setEmail('')
      setPassword('')
      toast.success('Compte Garmin connecté ! Lance une synchronisation pour importer tes données.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(null)
    }
  }

  /* ── Sync ───────────────────────────────────────────────────────────────── */
  async function handleSync() {
    setLoading('sync')
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur de synchronisation')
      const now = new Date().toISOString()
      setLastSync(now)
      toast.success(
        `✅ Sync réussie — ${data.activities_synced ?? 0} activité(s), ${data.wellness_synced ?? 0} jour(s) de forme importés.`
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de synchronisation')
    } finally {
      setLoading(null)
    }
  }

  /* ── Disconnect ─────────────────────────────────────────────────────────── */
  async function handleDisconnect() {
    if (!confirm('Déconnecter ton compte Garmin ? Tes données importées sont conservées.')) return
    setLoading('disconnect')
    try {
      const res = await fetch('/api/garmin/connect', { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      setConnected(false)
      setLastSync(null)
      toast.success('Compte Garmin déconnecté.')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la déconnexion')
    } finally {
      setLoading(null)
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Garmin Connect
            </CardTitle>
            <CardDescription className="mt-1">
              Activités, HRV, Body Battery, sommeil
            </CardDescription>
          </div>
          {connected && (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${MINT}20`, color: MINT }}
            >
              ● Connecté
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {connected ? (
          /* ── Connected state ────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Last sync info */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary text-sm">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: MINT }}
              />
              <div>
                <span className="text-muted-foreground text-xs">Dernière synchronisation</span>
                <p className="font-semibold text-sm">
                  {lastSync
                    ? new Date(lastSync).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : 'Jamais — lance une première synchronisation'}
                </p>
              </div>
            </div>

            {/* What gets imported */}
            <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {['Activités (14j)', 'HRV (RMSSD)', 'Body Battery', 'Sommeil & stress'].map(item => (
                <li key={item} className="flex items-center gap-1.5">
                  <span style={{ color: MINT }}>✓</span> {item}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSync}
                disabled={loading !== null}
                className="flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: MINT, color: DARK }}
              >
                {loading === 'sync' ? '⏳ Synchronisation…' : '↺ Synchroniser maintenant'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading !== null}
                className="px-4 py-2.5 rounded-xl font-bold text-xs border transition-all text-destructive/60 border-destructive/20 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
              >
                {loading === 'disconnect' ? '…' : 'Déconnecter'}
              </button>
            </div>
          </div>
        ) : (
          /* ── Connect form ───────────────────────────────────────────────── */
          <form onSubmit={handleConnect} className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connecte ton compte Garmin Connect pour importer automatiquement
              tes activités et données de forme dans Coach Tri.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Email Garmin Connect
              </Label>
              <Input
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Mot de passe
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span>🔒</span>
              <span>
                Identifiants chiffrés AES-256 côté serveur. Jamais stockés en clair,
                jamais partagés avec des tiers.
              </span>
            </p>

            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: MINT, color: DARK }}
            >
              {loading === 'connect' ? '⏳ Connexion…' : 'Connecter mon compte Garmin'}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
