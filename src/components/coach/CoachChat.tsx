'use client'

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUp, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface ProposedAction {
  type: 'cancel_session' | 'move_session' | 'adjust_session' | 'regenerate_week'
  description: string
  params: Record<string, unknown>
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposed_action: ProposedAction | null
  action_status: 'pending' | 'confirmed' | 'rejected' | null
  created_at: string
}

interface CoachChatProps {
  /** Texte placé dans le champ à l'ouverture (ex. « Parler de cette séance »). */
  initialInput?: string
  /** Questions proposées sous forme de pastilles ; un clic remplit le champ. */
  suggestions?: string[]
  /** Ref du champ, pour que le tiroir y place le focus à l'ouverture. */
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

export default function CoachChat({
  initialInput = '',
  suggestions = [],
  inputRef,
}: CoachChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(initialInput)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/chat?limit=20')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data as Message[])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)

    const tempId = `tmp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        content: msg,
        proposed_action: null,
        action_status: null,
        created_at: new Date().toISOString(),
      },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (res.ok && data) {
        setMessages((prev) => [...prev, data as Message])
      } else {
        toast.error(
          (data as { error?: string })?.error ?? "Le coach n'a pas pu répondre. Réessaie.",
        )
      }
    } catch {
      toast.error('Erreur réseau — message non envoyé.')
    } finally {
      setSending(false)
    }
  }, [input, sending])

  const handleAction = useCallback(
    async (msgId: string, status: 'confirmed' | 'rejected') => {
      setConfirming(msgId)
      try {
        const res = await fetch(`/api/chat/${msgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_status: status }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error((data as { error?: string })?.error ?? "Impossible de traiter l'action.")
          return
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, action_status: status } : m)),
        )

        if (status === 'confirmed' && data.type === 'regenerate_week' && data.regenerateParams) {
          const { plan_id, week_num, available_days } = data.regenerateParams
          await fetch(`/api/plans/${plan_id}/regenerate-week`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ week_num, available_days }),
          })
          router.refresh()
        } else if (status === 'confirmed') {
          router.refresh()
        }
      } finally {
        setConfirming(null)
      }
    },
    [router],
  )

  const resetConversation = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setMessages([])
    } catch {
      toast.error('Impossible de réinitialiser la conversation.')
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !sending && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Parle-moi de ta forme, d&apos;un empêchement, ou demande un conseil.
          </p>
        )}

        <ol className="flex flex-col gap-5">
          {messages.map((msg) => {
            const fromUser = msg.role === 'user'
            return (
              <li key={msg.id} className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    'font-mono text-[11px] tracking-[0.06em] uppercase',
                    fromUser ? 'text-muted-foreground' : 'text-primary-ink',
                  )}
                >
                  {fromUser ? 'Toi' : 'Coach'}
                </span>
                <p
                  className={cn(
                    'text-[15px] leading-relaxed whitespace-pre-wrap',
                    fromUser
                      ? 'text-muted-foreground'
                      : 'border-l-4 border-primary pl-3.5 text-foreground',
                  )}
                >
                  {msg.content}
                </p>

                {!fromUser && msg.proposed_action && (
                  <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                    <span className="text-xs font-bold tracking-[0.1em] text-primary-ink uppercase">
                      Action proposée
                    </span>
                    <p>{msg.proposed_action.description}</p>

                    {msg.action_status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="highlight"
                          size="sm"
                          onClick={() => handleAction(msg.id, 'confirmed')}
                          disabled={confirming === msg.id}
                        >
                          {confirming === msg.id ? 'En cours…' : 'Appliquer'}
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleAction(msg.id, 'rejected')}
                          disabled={confirming === msg.id}
                        >
                          Ignorer
                        </Button>
                      </div>
                    )}
                    {msg.action_status === 'confirmed' && (
                      <p className="flex items-center gap-1.5 text-xs font-bold text-primary-ink">
                        <Check size={14} strokeWidth={2.5} />
                        Action appliquée
                      </p>
                    )}
                    {msg.action_status === 'rejected' && (
                      <p className="text-xs text-muted-foreground">Action ignorée</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        {sending && (
          <p className="mt-5 font-mono text-xs text-primary-ink" aria-live="polite">
            Le coach écrit…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Saisie */}
      <div className="flex flex-col gap-3 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setInput(s)
                  inputRef?.current?.focus()
                }}
                className="rounded-full border-[1.5px] border-primary bg-card px-3 py-1 text-xs font-semibold text-primary-ink transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-3xl border-[1.5px] border-primary bg-card py-1.5 pr-1.5 pl-4 focus-within:ring-3 focus-within:ring-primary/25">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pose une question au coach"
            aria-label="Message au coach"
            rows={1}
            disabled={sending}
            className="max-h-24 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || sending}
            aria-label="Envoyer"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground transition-colors hover:bg-highlight-deep disabled:opacity-40"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={resetConversation}
          className="self-start text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Nouvelle conversation
        </button>
      </div>
    </div>
  )
}
