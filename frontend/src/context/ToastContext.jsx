import { createContext, useContext, useState, useCallback } from 'react'
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi'

var ToastContext = createContext(null)

var ICONS = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  info: FiInfo,
}

var COLORS = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
}

var ICON_COLORS = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
}

export function ToastProvider({ children }) {
  var [toasts, setToasts] = useState([])

  var showToast = useCallback(function (message, type) {
    type = type || 'info'
    var id = Date.now() + Math.random()
    setToasts(function (prev) { return [...prev, { id, message, type }] })
    setTimeout(function () {
      setToasts(function (prev) { return prev.filter(function (t) { return t.id !== id }) })
    }, 4000)
  }, [])

  var removeToast = useCallback(function (id) {
    setToasts(function (prev) { return prev.filter(function (t) { return t.id !== id }) })
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(function (toast) {
          var Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              className={'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-xl animate-slide-in max-w-sm ' + COLORS[toast.type]}
              style={{ animation: 'slideIn 0.3s ease-out' }}
            >
              <Icon className={'w-5 h-5 shrink-0 ' + ICON_COLORS[toast.type]} />
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={function () { removeToast(toast.id) }}
                className="p-0.5 hover:opacity-70 transition-opacity shrink-0"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  var ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
