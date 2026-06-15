import { useState } from 'react'
import { FiChevronUp, FiChevronDown } from 'react-icons/fi'

export default function BottomSheet(props) {
  var { children, expanded, onToggle, title, className } = props
  var isExpanded = expanded !== undefined ? expanded : true

  return (
    <div className={'absolute bottom-0 left-0 right-0 z-[1000] transition-all duration-300 ' + (className || '')}>
      <div
        className={
          'bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 rounded-t-2xl shadow-2xl transition-all duration-300 ' +
          (isExpanded ? 'max-h-[70vh]' : 'max-h-16')
        }
      >
        {onToggle && (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center py-2 hover:bg-white/5 rounded-t-2xl transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              {isExpanded ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
              {title || (isExpanded ? 'Collapse' : 'Expand')}
            </div>
          </button>
        )}
        <div className={'overflow-y-auto px-4 pb-6 ' + (isExpanded ? 'max-h-[calc(70vh-3rem)]' : 'max-h-0 overflow-hidden')}>
          {children}
        </div>
      </div>
    </div>
  )
}
