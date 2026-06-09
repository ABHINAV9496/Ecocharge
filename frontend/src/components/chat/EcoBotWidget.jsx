/*
  EcoBot Chat Widget
  ------------------
  A floating chat button (bottom-right corner) that opens an AI chatbot.

  How it works:
  1. Click the green chat button to open the chat window
  2. Type a question about EV trips, charging stations, or battery range
  3. The message is sent to a FastAPI AI service for a response
  4. EcoBot responds with helpful information

  Features:
  - Suggestion buttons for common questions
  - Typing indicator while waiting for response
  - Auto-scroll to the latest message
  - Press Enter to send
*/

import { useState, useEffect } from 'react'
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi'
import { chatWithEcoBot } from '../../api/ai'

// ----------------------------------------------------------------
// MAIN COMPONENT: EcoBot Widget
// ----------------------------------------------------------------
export default function EcoBotWidget() {
  // ---- STATE ----
  var [isOpen, setIsOpen] = useState(false)  // Is the chat window open?
  var [messages, setMessages] = useState([   // Chat message history
    {
      role: 'assistant',
      text: "Hi! I'm EcoBot. Ask me anything about EV trips, charging stations, or battery range!",
    },
  ])
  var [input, setInput] = useState('')        // Current text input
  var [isLoading, setIsLoading] = useState(false)  // Waiting for AI response

  // ---- AUTO-SCROLL TO BOTTOM WHEN NEW MESSAGES ARRIVE ----
  useEffect(function () {
    var chatContainer = document.getElementById('ecobot-chat-scroll')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [messages])

  // ---- HANDLE SEND MESSAGE ----
  async function handleSend() {
    // Guard clause: don't send empty messages or while loading
    if (!input.trim() || isLoading) return

    var userMessage = input.trim()
    setInput('')

    // Add the user's message to the chat
    setMessages(messages.concat([{ role: 'user', text: userMessage }]))

    setIsLoading(true)

    try {
      // Call the AI service with the full message history
      var response = await chatWithEcoBot({
        messages: messages.concat([{ role: 'user', text: userMessage }]),
      })

      var botResponse = response.data.response ||
                        response.data.message ||
                        'EcoBot is currently offline.'

      setMessages(function (currentMessages) {
        return currentMessages.concat([{ role: 'assistant', text: botResponse }])
      })

    } catch (error) {
      console.error('EcoBot AI service error:', error)

      setMessages(function (currentMessages) {
        return currentMessages.concat([
          {
            role: 'assistant',
            text: "I'm having trouble connecting to the AI service. Please make sure the FastAPI service is running."
          },
        ])
      })
    }

    setIsLoading(false)
  }

  // ---- HANDLE KEYBOARD SHORTCUT ----
  // Press Enter to send (Shift+Enter for new line)
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  // ---- HELPER: Fill input with suggestion text ----
  function fillSuggestion(text) {
    setInput(text)
  }

  // ---- SUGGESTION BUTTONS ----
  var suggestions = [
    'Find me the nearest charging station',
    'Plan a trip from Kochi to Munnar',
    'What if I start at 60% battery?',
    'How much will a charge cost?',
  ]

  // ---- RENDER ----
  return (
    <>
      {/* CASE: Floating action button (when chat is closed) */}
      {!isOpen && (
        <button
          onClick={function () { setIsOpen(true) }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-xl flex items-center justify-center hover:from-emerald-600 hover:to-emerald-700 transition-all hover:scale-105 active:scale-95 animate-fadeIn"
          aria-label="Open EcoBot chat"
        >
          <FiMessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* CASE: Chat window (when open) */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col animate-slideUp max-h-[600px]">

          {/* ---- HEADER ---- */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-gray-900 dark:to-gray-900 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FiMessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">EcoBot</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">EV Trip Assistant</p>
              </div>
            </div>
            <button
              onClick={function () { setIsOpen(false) }}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
              aria-label="Close chat"
            >
              <FiX className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* ---- MESSAGES ---- */}
          <div
            id="ecobot-chat-scroll"
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ maxHeight: '320px' }}
          >
            {messages.map(function (msg, index) {
              var isUser = msg.role === 'user'
              return (
                <div
                  key={index}
                  className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={
                      'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ' +
                      (isUser
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md')
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              )
            })}

            {/* CASE: Loading / typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---- SUGGESTIONS ---- */}
          {messages.length === 1 && (
            <div className="px-4 pb-3">
              <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wider">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(function (suggestion) {
                  return (
                    <button
                      key={suggestion}
                      onClick={function () { fillSuggestion(suggestion) }}
                      className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 border border-gray-200 dark:border-gray-700 transition-all"
                    >
                      {suggestion}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ---- INPUT BAR ---- */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={function (e) { setInput(e.target.value) }}
                onKeyDown={handleKeyDown}
                placeholder="Ask EcoBot..."
                rows={1}
                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={[
                  'p-2.5 rounded-xl transition-all',
                  (!input.trim() || isLoading)
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700',
                ].join(' ')}
                aria-label="Send message"
              >
                <FiSend className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
