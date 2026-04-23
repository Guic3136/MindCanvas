import { useCallback, useRef, useState } from 'react'
import { Send, Square } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
  streaming?: boolean
  onStop?: () => void
}

export default function ChatNodeInput({ onSend, disabled, streaming, onStop }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [hasText, setHasText] = useState(false)

  const handleSend = useCallback(() => {
    const el = textRef.current
    if (!el) return
    const value = el.value.trim()
    if (!value || disabled) return
    onSend(value)
    el.value = ''
    el.style.height = 'auto'
    setHasText(false)
  }, [onSend, disabled])

  const handleInput = useCallback(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
    setHasText(!!el.value.trim())
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="px-3 pb-3 pt-1 border-t border-border flex gap-2 items-end">
      <textarea
        ref={textRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        rows={1}
        className="flex-1 bg-bg-input text-text-primary text-sm rounded px-3 py-2 resize-none outline-none border border-border inset-input max-h-[150px]"
        disabled={disabled}
      />
      {streaming ? (
        <button
          onClick={onStop}
          className="self-end p-2.5 bg-danger/20 hover:bg-danger/30 text-danger rounded transition-ui"
          aria-label="停止生成"
          title="停止生成"
        >
          <Square size={16} />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={disabled || !hasText}
          className="self-end p-2.5 bg-brand hover:bg-brand-hover disabled:bg-bg-surface disabled:text-text-muted text-text-inverse rounded transition-ui"
          aria-label="发送消息"
        >
          <Send size={18} />
        </button>
      )}
    </div>
  )
}
