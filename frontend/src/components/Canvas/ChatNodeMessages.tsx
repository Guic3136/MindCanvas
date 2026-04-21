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
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-100'
          }`}>
            {m.content}
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 whitespace-pre-wrap">
            {streaming}
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
