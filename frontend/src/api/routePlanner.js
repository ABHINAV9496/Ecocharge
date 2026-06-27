import apiClient from './client'

export function planRoute(data) {
  return apiClient.post('/api/trips/plan/', data)
}

export async function planRouteStream(data, onProgress, onResult, onError) {
  try {
    var token = localStorage.getItem('access_token')
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    var response = await fetch('/api/trips/plan-stream/', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      var errText = await response.text()
      onError('Request failed: ' + response.status + ' ' + errText)
      return
    }
    var reader = response.body.getReader()
    var decoder = new TextDecoder()
    var buffer = ''
    while (true) {
      var result = await reader.read()
      if (result.done) break
      buffer += decoder.decode(result.value, { stream: true })
      var lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim()
        if (!line) continue
        try {
          var msg = JSON.parse(line)
          if (msg.progress) {
            onProgress(msg.progress)
          } else if (msg.result) {
            onResult(msg.result)
            return
          } else if (msg.error) {
            onError(msg.error)
            return
          }
        } catch (e) {
          console.warn('Failed to parse stream line:', line, e)
        }
      }
    }
  } catch (e) {
    onError(e.message || 'Network error')
  }
}
