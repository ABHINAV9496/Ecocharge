var AI_API_URL = 'http://127.0.0.1:8001'

export async function sendChatMessage(message) {
  var response = await fetch(AI_API_URL + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message }),
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

export async function sendChatMessageSimple(message) {
  var response = await fetch(AI_API_URL + '/api/chat/simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message }),
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
