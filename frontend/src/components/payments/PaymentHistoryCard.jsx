import { useState, useEffect } from 'react'
import { FiCreditCard, FiCheckCircle, FiXCircle, FiClock, FiRefreshCw } from 'react-icons/fi'
import { getPaymentHistory } from '../../api/payments'
import { formatCurrency, formatDate } from '../../utils/formatters'

var STATUS_STYLES = {
  CAPTURED: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: FiCheckCircle, color: 'text-emerald-500', label: 'Paid' },
  AUTHORIZED: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: FiClock, color: 'text-blue-500', label: 'Authorized' },
  CREATED: { bg: 'bg-gray-50 dark:bg-gray-900', icon: FiClock, color: 'text-gray-400', label: 'Pending' },
  FAILED: { bg: 'bg-red-50 dark:bg-red-900/20', icon: FiXCircle, color: 'text-red-500', label: 'Failed' },
  REFUNDED: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: FiRefreshCw, color: 'text-amber-500', label: 'Refunded' },
}

export default function PaymentHistoryCard() {
  var [payments, setPayments] = useState([])
  var [loading, setLoading] = useState(true)

  useEffect(function () {
    loadPayments()
  }, [])

  async function loadPayments() {
    try {
      var res = await getPaymentHistory()
      setPayments(res.data.payments || [])
    } catch (e) {
      console.error('Failed to load payment history:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiCreditCard className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payment History</h3>
        </div>
        <button onClick={loadPayments} className="p-1.5 text-gray-400 hover:text-emerald-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
          <FiRefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(function (i) {
            return <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
          })}
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-6">
          <FiCreditCard className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">No payments yet</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {payments.slice(0, 5).map(function (p) {
            var style = STATUS_STYLES[p.status] || STATUS_STYLES.CREATED
            var Icon = style.icon
            return (
              <div key={p.id} className={'flex items-center justify-between py-2.5 px-3 rounded-xl ' + style.bg}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={'w-4 h-4 shrink-0 ' + style.color} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                      {p.booking_station || 'Charging'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(p.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{'\u20B9'}{parseFloat(p.amount).toFixed(2)}</span>
                  <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded-full ' + style.color + ' bg-white/60 dark:bg-gray-900/60'}>{style.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
