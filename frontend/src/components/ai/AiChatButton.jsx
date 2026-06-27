import { useAI } from '../../context/AIContext'

export default function AiChatButton() {
  var { toggleOpen, isOpen } = useAI()

  return (
    <button
      onClick={toggleOpen}
      className={[
        'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl',
        isOpen
          ? 'bg-gray-200 dark:bg-gray-700 rotate-90 scale-0 opacity-0 pointer-events-none'
          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/30 scale-100 opacity-100',
      ].join(' ')}
      title="Ask EcoCharge AI"
    >
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    </button>
  )
}
