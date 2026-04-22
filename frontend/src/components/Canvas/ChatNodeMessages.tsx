import { useEffect, useRef } from 'react'
import type { Message } from '../../types'

interface Props {
  messages: Message[]
  streaming: string
}

export default function ChatNodeMessages({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            m.role === 'user'
              ? 'bg-accent text-text-primary'
              : 'bg-bg-surface text-text-secondary border border-border'
          }`}>
            {m.content}
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start" role="status" aria-live="polite" aria-label="AI 正在回复">
          <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-secondary border border-border whitespace-pre-wrap">
            {streaming}
            <span className="inline-flex gap-0.5 ml-1 align-text-bottom">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.2s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.4s infinite' }} />
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
