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

    var userMsgId = 'msg-' + Date.now()
    var assistantMsgId = 'msg-' + (Date.now() + 1)

    var userMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
    }

    var assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }

    setMessages(function (prev) { return prev.concat([userMessage, assistantPlaceholder]) })
    setIsStreaming(true)
    setStreamingContent('')

    try {
      var abortController = new AbortController()
      abortRef.current = abortController

      var history = messages
        .filter(function (m) { return m.id !== 'welcome' })
        .map(function (m) { return { role: m.role, content: m.content } })

      var response = await sendChatMessage(text, history, abortController.signal)
      var reader = response.body.getReader()
      var decoder = new TextDecoder()
      var fullContent = ''
      var buffer = ''

      while (true) {
        var result = await reader.read()
        if (result.done) break

        buffer += decoder.decode(result.value, { stream: true })
        var lines = buffer.split('\n')
        buffer = lines.pop()

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].replace('\r', '')
          if (line.startsWith('data: ')) {
            var data = line.slice(6)
            if (data === '[DONE]') continue
            fullContent += data
            setStreamingContent(fullContent)
          }
        }
      }

      setMessages(function (prev) {
        return prev.map(function (m) {
          if (m.id === assistantMsgId) {
            return { id: m.id, role: 'assistant', content: fullContent }
          }
          return m
        })
      })
      setStreamingContent('')
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Chat error:', err)

      setMessages(function (prev) {
        return prev.map(function (m) {
          if (m.id === assistantMsgId) {
            return { id: m.id, role: 'assistant', content: 'Sorry, I couldn\'t process your request. Please check your connection and try again.' }
          }
          return m
        })
      })
      setStreamingContent('')
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [isStreaming, messages])

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
