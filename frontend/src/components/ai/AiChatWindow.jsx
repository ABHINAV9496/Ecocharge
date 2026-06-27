import { useEffect, useRef } from 'react'
import { FiX, FiTrash2, FiMinus } from 'react-icons/fi'
import { useAI } from '../../context/AIContext'
import AiChatMessage from './AiChatMessage'
import AiChatInput from './AiChatInput'

export default function AiChatWindow() {
  var { messages, isOpen, isStreaming, streamingContent, close, clearChat } = useAI()
  var scrollRef = useRef(null)

  useEffect(function () {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  if (!isOpen) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-slideUp overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-emerald-600">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">EcoCharge AI</h3>
            <p className="text-[10px] text-white/70">EV Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Clear chat"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={close}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-2 space-y-1 scroll-smooth"
      >
        {messages.map(function (msg) {
          return (
            <AiChatMessage
              key={msg.id}
              message={msg}
              isStreaming={false}
            />
          )
        })}
        {isStreaming && streamingContent && (
          <AiChatMessage
            message={{ id: 'streaming', role: 'assistant', content: streamingContent }}
            isStreaming={true}
          />
        )}
      </div>

      {/* Input */}
      <AiChatInput />
    </div>
  )
}
