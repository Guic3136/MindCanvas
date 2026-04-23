import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check } from 'lucide-react'
import type { Message } from '../../types'

interface Props {
  messages: Message[]
  streaming: string
}

const BOTTOM_THRESHOLD = 100

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard may fail in iframes */ }
  }, [content])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1 right-1 p-1 rounded text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
      title="复制"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export default function ChatNodeMessages({ messages, streaming }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isNearBottom = useRef(true)
  const prevMessageCount = useRef(messages.length)

  // Track whether user is near the bottom
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      isNearBottom.current = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll logic
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessageCount.current
    prevMessageCount.current = messages.length

    if (messageCountChanged || isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: messageCountChanged ? 'smooth' : 'auto' })
    }
  }, [messages, streaming])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`relative group max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            m.role === 'user'
              ? 'bg-accent text-text-primary'
              : 'bg-bg-surface text-text-secondary border border-border'
          }`}>
            <CopyButton content={m.content} />
            {m.role === 'user' ? (
              <div className="whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      ))}
      {streaming !== '' && (
        <div className="flex justify-start" role="status" aria-live="polite" aria-label="AI 正在回复">
          <div className="relative group max-w-[85%] rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-secondary border border-border">
            {streaming.trim() === '' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">思考中</span>
                <span className="inline-flex gap-0.5 align-text-bottom">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0s infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.2s infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.4s infinite' }} />
                </span>
              </div>
            ) : (
              <>
                <CopyButton content={streaming} />
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {streaming}
                  </ReactMarkdown>
                </div>
                <span className="inline-flex gap-0.5 ml-1 align-text-bottom">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0s infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.2s infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" style={{ animation: 'dot-pulse 1.4s ease-in-out 0.4s infinite' }} />
                </span>
              </>
            )}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
