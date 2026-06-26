/**
 * AI API 调用工具
 * 支持流式输出（SSE）
 */

/**
 * 发送聊天请求（流式）
 * @param {Object} options
 * @param {string} options.baseUrl - API 基础地址
 * @param {string} options.apiKey - API Key
 * @param {string} options.model - 模型名称
 * @param {Array} options.messages - 消息数组
 * @param {Function} options.onChunk - 每次收到数据块的回调
 * @param {Function} options.onDone - 完成回调
 * @param {Function} options.onError - 错误回调
 * @param {AbortSignal} options.signal - 取消信号
 * @returns {Promise}
 */
export async function streamChat({ baseUrl, apiKey, model, messages, onChunk, onDone, onError, signal }) {
  const url = `${baseUrl}/chat/completions`

  try {
    // 检查消息中是否有图片（图片请求可能需要更长时间）
    const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))
    if (hasImage) {
      console.log('[API] 发送包含图片的请求，模型:', model)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`API 请求失败 (${response.status}): ${errorData}`)
    }

    // 检查响应类型，如果不是 stream 则当作普通 JSON 处理
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      // 某些代理可能不支持 stream，返回完整 JSON
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      onChunk?.(content, content)
      onDone?.(content)
      return content
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk?.(content, fullContent)
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    onDone?.(fullContent)
    return fullContent
  } catch (error) {
    if (error.name === 'AbortError') {
      onDone?.(null)
      return null
    }
    onError?.(error)
    throw error
  }
}

/**
 * 拉取模型列表
 * @param {string} baseUrl - API 基础地址
 * @param {string} apiKey - API Key
 * @returns {Promise<string[]>} 模型 ID 列表
 */
export async function fetchModels({ baseUrl, apiKey }) {
  const url = `${baseUrl}/models`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`拉取模型列表失败 (${response.status}): ${errorData}`)
  }

  const data = await response.json()
  // OpenAI 格式返回 { data: [{ id: "model-name", ... }, ...] }
  const models = (data.data || []).map(m => m.id).sort()
  return models
}

/**
 * 非流式请求（用于总结等）
 */
export async function chatComplete({ baseUrl, apiKey, model, messages }) {
  const url = `${baseUrl}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`API 请求失败 (${response.status}): ${errorData}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage || null
  }
}
