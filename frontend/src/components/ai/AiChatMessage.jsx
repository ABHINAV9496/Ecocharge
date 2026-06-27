import { useState } from 'react'
import { FiUser, FiCopy, FiCheck } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function AiChatMessage({ message, isStreaming }) {
  var isUser = message.role === 'user'
  var isAssistant = message.role === 'assistant'
  var [copiedId, setCopiedId] = useState(null)

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    setCopiedId(code.slice(0, 20))
    setTimeout(function () { setCopiedId(null) }, 2000)
  }

  return (
    <div className={[
      'flex gap-3 px-4 py-3',
      isUser ? 'justify-end' : 'justify-start',
    ].join(' ')}>
      {isAssistant && (
        <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}

      <div className={[
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-emerald-500 text-white rounded-tr-sm'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-gray-700',
      ].join(' ')}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:relative prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: function (props) {
                  var inline = props.inline
                  var className = props.className
                  var children = props.children
                  if (inline) {
                    return <code className={className}>{children}</code>
                  }
                  var code = String(children).replace(/\n$/, '')
                  var isCopied = copiedId === code.slice(0, 20)
                  return (
                    <div className="relative group">
                      <button
                        onClick={function () { copyCode(code) }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy code"
                      >
                        {isCopied
                          ? <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                          : <FiCopy className="w-3.5 h-3.5 text-gray-400" />
                        }
                      </button>
                      <code className={className}>{children}</code>
                    </div>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-flex gap-0.5 ml-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
          <FiUser className="w-4 h-4 text-gray-500 dark:text-gray-300" />
        </div>
      )}
    </div>
  )
}
