/*
  Wallet API
  ----------
  Manages the digital wallet. Users can top up their wallet and
  check their balance. Bookings deduct money from the wallet.
*/

import apiClient from './client'

// Get current wallet balance for the logged-in user
export function getBalance() {
  return apiClient.get('/api/wallet/balance/')
}

// Add money to the wallet (max Rs. 10,000 per transaction)
// amount should be a number (e.g., 500 means Rs. 500)
export function topUp(amount) {
  return apiClient.post('/api/wallet/topup/', { amount: amount })
}

// Get list of all wallet transactions (top-ups, deductions, refunds)
export function getTransactions() {
  return apiClient.get('/api/wallet/transactions/')
}
