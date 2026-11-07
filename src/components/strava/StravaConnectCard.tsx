'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatSyncDate } from '@/lib/utils/format-sync-date'

interface Props {
  connected: boolean
  lastSyncAt: string | null
}

export function StravaConnectCard({
  connected: initialConnected,
  lastSyncAt: initialLastSync,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState(initialConnected)
  const [lastSync, setLastSync] = useState(initialLastSync)
  const [loading, setLoading] = useState<'sync' | 'disconnect' | null>(null)

  useEffect(() => {
    if (searchParams.get('strava_connected') === '1') {
      // Le serveur renvoie déjà connected=true après le callback OAuth ;
      // on nettoie juste l'URL et on confirme à l'utilisateur.
      toast.success(
        'Compte Strava connecté ! Lance une synchronisation pour importer tes activités.',
      )
      router.replace('/profile')
    }
    const stravaError = searchParams.get('strava_error')
    if (stravaError) {
      toast.error(
        stravaError === 'missing_scope'
          ? 'Strava n’a pas donné accès à tes activités. Reconnecte-toi en cochant « Voir les données de tes activités ».'
          : 'Impossible de connecter Strava. Réessaie.',
      )
      router.replace('/profile')
    }
  }, [searchParams, router])

  async function handleSync() {
    setLoading('sync')
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur de synchronisation')
      setLastSync(new Date().toISOString())
      toast.success(`Sync Strava — ${data.activities_synced ?? 0} activité(s) importée(s).`)
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-lg font-bold">Strava</CardTitle>
            <CardDescription className="mt-1">
              Activités, charge d&apos;entraînement, coach IA enrichi
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dernière synchronisation :{' '}
              <span className="font-medium text-foreground">
                {lastSync
                  ? formatSyncDate(lastSync)
                  : 'Jamais — lance une première synchronisation'}
              </span>
            </p>

            <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {['Activités (30j)', 'Coach enrichi', "Charge d'entraînement", 'Stats YTD'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 shrink-0 text-primary-ink" /> {item}
                  </li>
                ),
              )}
            </ul>

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
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connecte Strava pour enrichir le coach IA avec tes activités récentes et ta charge
              d&apos;entraînement.
            </p>
            <a href="/api/strava/connect" className={buttonVariants({ className: 'w-full' })}>
              Connecter avec Strava
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
