'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ACCENT as MINT, SURFACE as DARK, SURFACE_DEEP as DARKER, DIVIDER as DIV, withAlpha } from '@/lib/theme'

const MUTED = 'oklch(1 0 0 / 40%)'

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

interface Props {
  planId: string | null
}

export default function CoachChat({ planId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/chat?limit=20')
      .then(r => r.json())
      .then(data => {
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
    setMessages(prev => [...prev, {
      id: tempId, role: 'user', content: msg,
      proposed_action: null, action_status: null,
      created_at: new Date().toISOString(),
    }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (res.ok && data) {
        setMessages(prev => [...prev, data as Message])
      }
    } catch {
      // silently ignore
    } finally {
      setSending(false)
    }
  }, [input, sending])

  const handleAction = useCallback(async (msgId: string, status: 'confirmed' | 'rejected') => {
    setConfirming(msgId)
    try {
      const res = await fetch(`/api/chat/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_status: status }),
      })
      const data = await res.json()
      if (!res.ok) return

      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, action_status: status } : m
      ))

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
  }, [router])

  const resetConversation = useCallback(async () => {
    const res = await fetch('/api/chat', { method: 'DELETE' })
    if (res.ok) {
      setMessages([])
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: DARK, border: `1px solid ${DIV}`, height: '420px' }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${DIV}`, backgroundColor: DARKER }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: `${withAlpha(MINT, 12)}`, border: `1px solid ${withAlpha(MINT, 30)}` }}
        >
          🤖
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MINT }}>
            Coach IA
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {sending && (
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: MINT, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
          <button
            onClick={resetConversation}
            className="text-xs uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: MUTED }}
            title="Démarrer une nouvelle conversation"
          >
            Nouvelle conv.
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !sending && (
          <p className="text-center text-xs py-8" style={{ color: MUTED }}>
            Parle-moi de ta forme, d&apos;un empêchement, ou demande un conseil !
          </p>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              style={msg.role === 'user'
                ? { backgroundColor: `${withAlpha(MINT, 16)}`, color: 'oklch(0.97 0 0)', border: `1px solid ${withAlpha(MINT, 30)}` }
                : { backgroundColor: DARKER, color: 'oklch(0.9 0 0)', border: `1px solid ${DIV}` }
              }
            >
              {msg.content}
            </div>

            {/* Proposed action */}
            {msg.role === 'assistant' && msg.proposed_action && (
              <div
                className="max-w-[85%] rounded-xl px-3 py-2 text-xs space-y-2"
                style={{ backgroundColor: `${withAlpha(MINT, 8)}`, border: `1px solid ${withAlpha(MINT, 22)}` }}
              >
                <p className="font-bold" style={{ color: MINT }}>
                  Action proposée
                </p>
                <p style={{ color: 'oklch(0.85 0 0)' }}>
                  {msg.proposed_action.description}
                </p>

                {msg.action_status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAction(msg.id, 'confirmed')}
                      disabled={confirming === msg.id}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold uppercase tracking-widest transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: MINT, color: DARK }}
                    >
                      {confirming === msg.id ? '...' : 'Confirmer'}
                    </button>
                    <button
                      onClick={() => handleAction(msg.id, 'rejected')}
                      disabled={confirming === msg.id}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold uppercase tracking-widest transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: `${DIV}`, color: 'oklch(0.7 0 0)', border: `1px solid ${DIV}` }}
                    >
                      Refuser
                    </button>
                  </div>
                )}

                {msg.action_status === 'confirmed' && (
                  <p className="text-xs font-bold" style={{ color: MINT }}>✓ Action effectuée</p>
                )}
                {msg.action_status === 'rejected' && (
                  <p className="text-xs" style={{ color: MUTED }}>Refusée</p>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 flex gap-2 items-end flex-shrink-0"
        style={{ borderTop: `1px solid ${DIV}`, backgroundColor: DARKER }}
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Comment tu te sens ? Un empêchement ?"
          rows={1}
          disabled={sending}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: DARKER,
            border: `1px solid ${DIV}`,
            color: 'oklch(0.95 0 0)',
            maxHeight: '80px',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ backgroundColor: MINT, color: DARK }}
          aria-label="Envoyer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
