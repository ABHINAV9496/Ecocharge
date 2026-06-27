import { useState, useRef } from 'react'
import { FiSend } from 'react-icons/fi'
import { useAI } from '../../context/AIContext'

export default function AiChatInput() {
  var { sendMessage, isStreaming } = useAI()
  var [text, setText] = useState('')
  var inputRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || isStreaming) return
    sendMessage(text.trim())
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={function (e) { setText(e.target.value) }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about EVs, charging..."
          rows={1}
          disabled={isStreaming}
          className={[
            'flex-1 resize-none px-3 py-2.5 text-sm rounded-xl outline-none transition-all',
            'border border-gray-300 dark:border-gray-600',
            'bg-gray-50 dark:bg-gray-900',
            'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
            'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
            isStreaming ? 'opacity-50' : '',
          ].join(' ')}
        />
        <button
          type="submit"
          disabled={!text.trim() || isStreaming}
          className={[
            'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all',
            text.trim() && !isStreaming
              ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          <FiSend className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}
