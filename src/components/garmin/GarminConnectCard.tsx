'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, Lock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Props {
  connected: boolean
  lastSyncAt: string | null
}

export function GarminConnectCard({
  connected: initialConnected,
  lastSyncAt: initialLastSync,
}: Props) {
  const router = useRouter()
  const [connected, setConnected] = useState(initialConnected)
  const [lastSync, setLastSync] = useState(initialLastSync)
  const [loading, setLoading] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
        `Sync réussie — ${data.activities_synced ?? 0} activité(s), ${data.wellness_synced ?? 0} jour(s) de forme importés.`,
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-lg font-bold">Garmin Connect</CardTitle>
            <CardDescription className="mt-1">
              Activités, HRV, Body Battery, sommeil
            </CardDescription>
          </div>
          {connected ? (
            <Badge variant="outline" className="border-primary/40 text-primary-ink">
              <Check aria-hidden />
              Connecté
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Non connecté
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {connected ? (
          /* ── Connected state ────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Last sync info */}
            <p className="text-sm text-muted-foreground">
              Dernière synchronisation :{' '}
              <span className="font-medium text-foreground">
                {lastSync
                  ? new Date(lastSync).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Jamais — lance une première synchronisation'}
              </span>
            </p>

            {/* What gets imported */}
            <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {['Activités (14j)', 'HRV (RMSSD)', 'Body Battery', 'Sommeil & stress'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 shrink-0 text-primary-ink" /> {item}
                  </li>
                ),
              )}
            </ul>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={handleSync} disabled={loading !== null} className="flex-1">
                <RefreshCw
                  aria-hidden
                  className={loading === 'sync' ? 'animate-spin' : undefined}
                />
                {loading === 'sync' ? 'Synchronisation…' : 'Synchroniser maintenant'}
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={loading !== null}>
                {loading === 'disconnect' ? '…' : 'Déconnecter'}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Connect form ───────────────────────────────────────────────── */
          <form onSubmit={handleConnect} className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connecte ton compte Garmin Connect pour importer automatiquement tes activités et
              données de forme dans Coach Tri.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="garmin-email">Email Garmin Connect</Label>
              <Input
                id="garmin-email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="garmin-password">Mot de passe</Label>
              <Input
                id="garmin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Identifiants chiffrés AES-256 côté serveur. Jamais stockés en clair, jamais partagés
                avec des tiers.
              </span>
            </p>

            <Button type="submit" disabled={loading !== null} className="w-full">
              {loading === 'connect' && <Loader2 aria-hidden className="animate-spin" />}
              {loading === 'connect' ? 'Connexion…' : 'Connecter mon compte Garmin'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
