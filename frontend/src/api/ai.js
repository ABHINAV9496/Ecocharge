/*
  AI/FastAPI Service
  ------------------
  Communicates with the FastAPI microservice for:
  1. EcoBot chat conversations (LangChain + Llama 3.1)
  2. Battery consumption predictions (ML model)
  3. Route planning with charging stops

  If the AI service is not running, functions fail gracefully.
*/

import apiClient from './client'

// Send a message to EcoBot and get a reply
// messages should be an array of { role: "user"|"assistant", text: "..." }
export function chatWithEcoBot(data) {
  return apiClient.post('/ai/chat', data)
}

// Predict battery consumption for a trip
// data should contain: distance, elevation, temperature, traffic, efficiency, charge
export function predictBattery(data) {
  return apiClient.post('/ai/predict', data)
}

// Plan a full route with charging stops
// data should contain: origin, destination, battery_percent
export function planRoute(data) {
  return apiClient.post('/ai/route', data)
}
