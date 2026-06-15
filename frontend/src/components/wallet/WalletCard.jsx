/*
  Wallet Card
  -----------
  Shows the user's wallet balance and recent transactions.

  What you can do:
  1. See your current balance at a glance
  2. Click "Top Up" to add money to your wallet
  3. View recent transactions (top-ups and booking deductions)

  Notes:
  - Maximum single top-up is ₹10,000
  - Transactions are loaded from the backend API
  - Green = money in (top-up), Orange = money out (booking deduction)
*/

import { useState, useEffect } from 'react'
import { FiPlus, FiArrowUpRight, FiArrowDownLeft, FiRefreshCw } from 'react-icons/fi'
import { getBalance, topUp, getTransactions } from '../../api/wallet'
import { formatCurrency, formatDate } from '../../utils/formatters'

// ----------------------------------------------------------------
// MAIN COMPONENT: Wallet Card
// ----------------------------------------------------------------
export default function WalletCard() {
  // ---- STATE ----
  var [balance, setBalance] = useState(0)       // Current wallet balance
  var [transactions, setTransactions] = useState([])  // Transaction history
  var [showTopUp, setShowTopUp] = useState(false)      // Is the top-up form visible?
  var [amount, setAmount] = useState('')          // Top-up amount input
  var [isLoading, setIsLoading] = useState(false) // Loading state for top-up
  var [message, setMessage] = useState('')        // Success/error message
  var [dataError, setDataError] = useState('')    // Error loading wallet data

  // ---- LOAD WALLET DATA ON MOUNT ----
  useEffect(function () {
    loadWalletData()
  }, [])

  // ---- FETCH: Get balance and transactions from backend ----
  async function loadWalletData() {
    try {
      var results = await Promise.all([getBalance(), getTransactions()])
      var balanceResponse = results[0]
      var transactionsResponse = results[1]

      setBalance(balanceResponse.data.balance)

      var txList = transactionsResponse.data.transactions || []
      setTransactions(txList)

    } catch (error) {
      console.error('Failed to load wallet data:', error)
      setDataError('Could not load wallet. Make sure the backend is running.')
    }
  }

  // ---- HANDLE: Top-up the wallet ----
  async function handleTopUp() {
    // Guard clause: amount must be positive
    if (!amount || parseFloat(amount) <= 0) return

    setIsLoading(true)
    setMessage('')

    try {
      var response = await topUp(parseFloat(amount))
      var successMsg = response.data.message || 'Top-up successful'
      setMessage(successMsg)
      setAmount('')
      setShowTopUp(false)

      // Refresh balance and transactions after top-up
      loadWalletData()

    } catch (error) {
      var errorMsg = 'Top-up failed'
      if (error.response && error.response.data) {
        errorMsg = error.response.data.error || errorMsg
      }
      setMessage(errorMsg)
      console.error('Wallet top-up error:', errorMsg)
    }

    setIsLoading(false)
  }

  // ---- HELPER: Icon for transaction type ----
  function getTransactionIcon(type) {
    if (type === 'TOPUP') return { icon: FiArrowDownLeft, color: 'text-emerald-500' }
    if (type === 'DEDUCTION') return { icon: FiArrowUpRight, color: 'text-orange-500' }
    return { icon: FiRefreshCw, color: 'text-blue-500' }
  }

  // ---- HELPER: Text color for transaction type ----
  function getTransactionColor(type) {
    if (type === 'TOPUP') return 'text-emerald-600 dark:text-emerald-400'
    if (type === 'DEDUCTION') return 'text-orange-600 dark:text-orange-400'
    return 'text-blue-600 dark:text-blue-400'
  }

  // ---- RENDER ----
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">

      {/* ---- HEADER: Title + Top Up button ---- */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Wallet</h3>
        <button
          onClick={function () { setShowTopUp(!showTopUp) }}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all',
            showTopUp
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700',
          ].join(' ')}
        >
          <FiPlus className="w-3 h-3" />
          Top Up
        </button>
      </div>

      {/* ---- BALANCE DISPLAY ---- */}
      <div className="text-center mb-5">
        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
          {formatCurrency(balance)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Current Balance</p>
      </div>

      {/* Error loading data */}
      {dataError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl">
          {dataError}
        </div>
      )}

      {/* ---- TOP-UP FORM ---- */}
      {showTopUp && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3 animate-fadeIn">
          <input
            type="number"
            value={amount}
            onChange={function (e) { setAmount(e.target.value) }}
            placeholder="Enter amount (max ₹10,000)"
            min="1"
            max="10000"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          <button
            onClick={handleTopUp}
            disabled={isLoading || !amount}
            className={[
              'w-full py-2.5 text-sm font-medium rounded-xl transition-all',
              isLoading || !amount
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700',
            ].join(' ')}
          >
            {isLoading ? 'Processing...' : 'Add Money'}
          </button>
          {message && (
            <p className={'text-xs font-medium ' + (message.indexOf('fail') !== -1 || message.indexOf('Fail') !== -1 ? 'text-red-500' : 'text-emerald-500')}>
              {message}
            </p>
          )}
        </div>
      )}

      {/* ---- TRANSACTION HISTORY ---- */}
      {transactions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Recent Transactions
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {transactions.slice(0, 10).map(function (tx) {
              var TxIcon = getTransactionIcon(tx.transaction_type).icon
              var iconColor = getTransactionIcon(tx.transaction_type).color
              var amountColor = getTransactionColor(tx.transaction_type)
              var isDeduction = tx.transaction_type === 'DEDUCTION'

              return (
                <div key={tx.id} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <TxIcon className={'w-4 h-4 ' + iconColor} />
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {tx.description || tx.transaction_type}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span className={'text-xs font-semibold ' + amountColor}>
                    {isDeduction ? '-' : '+'}{'\u20B9'}{parseFloat(tx.amount).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CASE: No transactions yet */}
      {transactions.length === 0 && !dataError && (
        <div className="text-center py-4">
          <FiRefreshCw className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-xs text-gray-400 dark:text-gray-500">No transactions yet</p>
        </div>
      )}
    </div>
  )
}
