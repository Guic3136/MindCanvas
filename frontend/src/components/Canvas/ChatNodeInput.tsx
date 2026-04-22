import { useState } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatNodeInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="p-3 border-t border-border flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        placeholder="输入消息..."
        rows={2}
        className="flex-1 bg-bg-surface text-text-primary text-sm rounded px-3 py-2 resize-none outline-none border border-border inset-input"
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="self-end p-2.5 bg-brand hover:bg-brand-hover disabled:bg-bg-surface disabled:text-text-muted text-text-inverse rounded transition-ui"
        aria-label="发送消息"
      >
        <Send size={18} />
      </button>
    </div>
  )
}
