import { useState, useEffect } from 'react'
import { FiStar, FiMessageSquare } from 'react-icons/fi'
import { getReviews } from '../../api/stations'
import { formatDate } from '../../utils/formatters'

export default function StationReviews({ stationId }) {
  var [reviews, setReviews] = useState([])
  var [loading, setLoading] = useState(true)
  var [open, setOpen] = useState(false)

  useEffect(function () {
    if (!open) return
    setLoading(true)
    getReviews(stationId).then(function (res) {
      setReviews(res.data || [])
    }).catch(function () {}).finally(function () { setLoading(false) })
  }, [stationId, open])

  function renderStars(rating) {
    return Array.from({ length: 5 }, function (_, i) {
      return <FiStar key={i} className={'w-3 h-3 ' + (i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600')} />
    })
  }

  return (
    <div>
      <button onClick={function () { setOpen(!open) }} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-emerald-500 transition-colors">
        <FiMessageSquare className="w-3.5 h-3.5" />
        Reviews ({reviews.length || '...'})
        {open ? ' ▲' : ' ▼'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="text-xs text-gray-400">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-xs text-gray-400">No reviews yet</div>
          ) : (
            reviews.map(function (r) {
              return (
                <div key={r.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{r.username}</span>
                      <div className="flex">{renderStars(r.rating)}</div>
                    </div>
                    <span className="text-[10px] text-gray-400">{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.comment}</p>}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
