import { createContext, useContext, useState, useRef, useCallback } from 'react'
import { sendChatMessage } from '../api/ai'

var AIContext = createContext(null)

var WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I\'m EcoCharge AI. Ask me anything about EVs, charging, or battery technology.',
}

export function AIProvider(props) {
  var children = props.children
  var [messages, setMessages] = useState([WELCOME_MESSAGE])
  var [isOpen, setIsOpen] = useState(false)
  var [isStreaming, setIsStreaming] = useState(false)
  var [streamingContent, setStreamingContent] = useState('')
  var abortRef = useRef(null)

  function toggleOpen() {
    setIsOpen(function (v) { return !v })
  }

  function close() {
    setIsOpen(false)
  }

  var sendMessage = useCallback(async function (text) {
    if (!text.trim() || isStreaming) return

    var userMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
    }

    var assistantMessage = {
      id: 'msg-' + (Date.now() + 1),
      role: 'assistant',
      content: '',
    }

    setMessages(function (prev) { return prev.concat([userMessage]) })
    setIsStreaming(true)
    setStreamingContent('')

    try {
      var abortController = new AbortController()
      abortRef.current = abortController

      var history = messages
        .filter(function (m) { return m.id !== 'welcome' })
        .map(function (m) { return { role: m.role, content: m.content } })

      var response = await sendChatMessage(text, history)

      var reader = response.body.getReader()
      var decoder = new TextDecoder()
      var fullContent = ''

      while (true) {
        var result = await reader.read()
        if (result.done) break

        var chunk = decoder.decode(result.value, { stream: true })
        var lines = chunk.split('\n')

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim()
          if (line.startsWith('data: ')) {
            var data = line.slice(6)
            if (data === '[DONE]') continue
            fullContent += data
            setStreamingContent(fullContent)
          }
        }
      }

      setMessages(function (prev) {
        var updated = prev.slice(0, -1)
        return updated.concat([{
          id: assistantMessage.id,
          role: 'assistant',
          content: fullContent,
        }])
      })
      setStreamingContent('')
    } catch (err) {
      if (err.name === 'AbortError') return

      var errorReply = 'Sorry, I couldn\'t process your request. Please check your connection and try again.'
      setMessages(function (prev) {
        var updated = prev.slice(0, -1)
        return updated.concat([{
          id: assistantMessage.id,
          role: 'assistant',
          content: errorReply,
        }])
      })
      setStreamingContent('')
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [isStreaming])

  function clearChat() {
    setMessages([WELCOME_MESSAGE])
    setStreamingContent('')
  }

  return (
    <AIContext.Provider value={{
      messages: messages,
      isOpen: isOpen,
      isStreaming: isStreaming,
      streamingContent: streamingContent,
      toggleOpen: toggleOpen,
      close: close,
      sendMessage: sendMessage,
      clearChat: clearChat,
    }}>
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  var context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used inside of AIProvider')
  }
  return context
}
