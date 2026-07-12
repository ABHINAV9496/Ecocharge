var AI_API_URL = '/ai'

function getToken() {
  var raw = localStorage.getItem('access_token')
  if (raw === 'undefined' || raw === 'null') return ''
  return raw || ''
}

export async function sendChatMessage(message, history, signal) {
  var response = await fetch(AI_API_URL + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: signal,
    body: JSON.stringify({
      message: message,
      history: history || [],
      token: getToken(),
    }),
  })

  if (!response.ok) {
    var errorText = ''
    try {
      var errorData = await response.json()
      errorText = errorData.detail || 'Request failed'
    } catch (_) {
      errorText = 'Request failed with status ' + response.status
    }
    throw new Error(errorText)
  }

  return response
}

export async function sendChatMessageSimple(message, history) {
  var response = await fetch(AI_API_URL + '/api/chat/simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      history: history || [],
      token: getToken(),
    }),
  })

  if (!response.ok) {
    var errorText = ''
    try {
      var errorData = await response.json()
      errorText = errorData.detail || 'Request failed'
    } catch (_) {
      errorText = 'Request failed with status ' + response.status
    }
    throw new Error(errorText)
  }

  var data = await response.json()
  return data.reply
}
