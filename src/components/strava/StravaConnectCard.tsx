'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ACCENT as MINT, ACCENT_FG as DARK, withAlpha } from '@/lib/theme'

interface Props {
  connected: boolean
  lastSyncAt: string | null
}

const ORANGE = '#FC4C02' // couleur de marque Strava

export function StravaConnectCard({ connected: initialConnected, lastSyncAt: initialLastSync }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState(initialConnected)
  const [lastSync, setLastSync]   = useState(initialLastSync)
  const [loading, setLoading]     = useState<'sync' | 'disconnect' | null>(null)

  useEffect(() => {
    if (searchParams.get('strava_connected') === '1') {
      setConnected(true)
      toast.success('Compte Strava connecté ! Lance une synchronisation pour importer tes activités.')
      router.replace('/profile')
    }
    if (searchParams.get('strava_error')) {
      toast.error('Impossible de connecter Strava. Réessaie.')
      router.replace('/profile')
    }
  }, [searchParams, router])

  async function handleSync() {
    setLoading('sync')
    try {
      const res  = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur de synchronisation')
      setLastSync(new Date().toISOString())
      toast.success(`✅ Sync Strava — ${data.activities_synced ?? 0} activité(s) importée(s).`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de synchronisation')
    } finally {
      setLoading(null)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Déconnecter ton compte Strava ? Tes activités importées sont conservées.')) return
    setLoading('disconnect')
    try {
      const res = await fetch('/api/strava/disconnect', { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      setConnected(false)
      setLastSync(null)
      toast.success('Compte Strava déconnecté.')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la déconnexion')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span style={{ color: ORANGE }}>⬡</span> Strava
            </CardTitle>
            <CardDescription className="mt-1">
              Activités, charge d&apos;entraînement, coach IA enrichi
            </CardDescription>
          </div>
          {connected && (
            <span
              className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ backgroundColor: withAlpha(MINT, 12), color: MINT }}
            >
              ● Connecté
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary text-sm">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: MINT }} />
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

            <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {["Activités (30j)", "Coach enrichi", "Charge d'entraînement", "Stats YTD"].map(item => (
                <li key={item} className="flex items-center gap-1.5">
                  <span style={{ color: MINT }}>✓</span> {item}
                </li>
              ))}
            </ul>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSync}
                disabled={loading !== null}
                className="flex-1 py-2.5 rounded-xl font-semibold uppercase tracking-widest text-xs transition-all disabled:opacity-50 hover:opacity-90"
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connecte Strava pour enrichir le coach IA avec tes activités récentes et ta charge d&apos;entraînement.
            </p>
            <a
              href="/api/strava/connect"
              className="flex items-center justify-center w-full py-2.5 rounded-xl font-semibold uppercase tracking-widest text-xs transition-all hover:opacity-90"
              style={{ backgroundColor: ORANGE, color: '#fff' }}
            >
              Connecter avec Strava
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
