import { defineStore } from 'pinia'
import { ref } from 'vue'
import db from '../db'
import { streamChat } from '../utils/api'
import { useSettingsStore } from './settings'

export const useChatStore = defineStore('chat', () => {
  const currentConversation = ref(null)
  const messages = ref([])
  const isStreaming = ref(false)
  const streamingContent = ref('')
  const abortController = ref(null)

  // 加载对话消息
  async function loadMessages(conversationId) {
    const conv = await db.conversations.get(conversationId)
    currentConversation.value = conv
    const msgs = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('floor')
    messages.value = msgs
  }

  // 获取所有对话
  async function getConversations() {
    return await db.conversations.orderBy('updatedAt').reverse().toArray()
  }

  // 创建对话
  async function createConversation(title, characterId = null, worldBookId = null) {
    const now = Date.now()
    const id = await db.conversations.add({
      title,
      characterId,
      worldBookId,
      createdAt: now,
      updatedAt: now
    })
    return id
  }

  // 删除对话
  async function deleteConversation(id) {
    await db.messages.where('conversationId').equals(id).delete()
    await db.summaries.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  }

  // 获取下一个楼层号
  function getNextFloor() {
    if (messages.value.length === 0) return 1
    return Math.max(...messages.value.map(m => m.floor)) + 1
  }

  // 将 AI 回复内容保存为消息（支持聊天模式拆分）
  async function saveAssistantReply(content) {
    const settings = useSettingsStore()

    if (settings.chatMode) {
      // 按 --- 分隔符拆分成多条消息
      const parts = content.split(/\n---\n|^---\n|\n---$/)
        .map(s => s.trim())
        .filter(Boolean)

      for (const part of parts) {
        const floor = getNextFloor()
        const msg = {
          conversationId: currentConversation.value.id,
          role: 'assistant',
          content: part,
          floor,
          hidden: false,
          createdAt: Date.now()
        }
        const id = await db.messages.add(msg)
        msg.id = id
        messages.value.push(msg)
      }
    } else {
      // 普通模式：整条存储
      const floor = getNextFloor()
      const msg = {
        conversationId: currentConversation.value.id,
        role: 'assistant',
        content,
        floor,
        hidden: false,
        createdAt: Date.now()
      }
      const id = await db.messages.add(msg)
      msg.id = id
      messages.value.push(msg)
    }

    await db.conversations.update(currentConversation.value.id, { updatedAt: Date.now() })
  }

  // 添加用户消息
  async function addUserMessage(content, imageBase64 = null) {
    const floor = getNextFloor()
    const msg = {
      conversationId: currentConversation.value.id,
      role: 'user',
      content,
      imageBase64,
      floor,
      hidden: false,
      createdAt: Date.now()
    }
    const id = await db.messages.add(msg)
    msg.id = id
    messages.value.push(msg)

    // 更新对话时间
    await db.conversations.update(currentConversation.value.id, { updatedAt: Date.now() })

    return msg
  }

  // 添加多条用户消息（用于聊天模式拆分发送）
  async function addMultiUserMessages(text) {
    const settings = useSettingsStore()
    const lines = text.split('\n').filter(line => line.trim() !== '')

    const msgs = []
    for (const line of lines) {
      const floor = getNextFloor()
      const msg = {
        conversationId: currentConversation.value.id,
        role: 'user',
        content: line.trim(),
        imageBase64: null,
        floor,
        hidden: false,
        createdAt: Date.now()
      }
      const id = await db.messages.add(msg)
      msg.id = id
      msg._floor = floor
      msgs.push(msg)
    }

    messages.value.push(...msgs)

    // 更新对话时间
    await db.conversations.update(currentConversation.value.id, { updatedAt: Date.now() })

    return msgs
  }

  // 构建发送给 AI 的消息数组
  async function buildApiMessages() {
    const settings = useSettingsStore()
    const conv = currentConversation.value
    const apiMessages = []

    // 1. System Prompt（角色设定）
    let systemPrompt = ''
    if (conv.characterId) {
      const character = await db.characters.get(conv.characterId)
      if (character) {
        systemPrompt = character.systemPrompt || ''
      }
    }

    // 2. 世界书条目（关键词匹配 + 手动启用）
    if (conv.worldBookId) {
      const entries = await db.worldBookEntries
        .where('worldBookId')
        .equals(conv.worldBookId)
        .toArray()

      const recentText = messages.value
        .filter(m => !m.hidden)
        .slice(-10)
        .map(m => m.content)
        .join(' ')

      const activeEntries = entries.filter(entry => {
        if (entry.enabled) return true
        if (entry.keywords && entry.keywords.length > 0) {
          return entry.keywords.some(kw => recentText.includes(kw))
        }
        return false
      })

      // 按深度排序：深度越大越重要，排在前面（AI更容易注意到）
      activeEntries.sort((a, b) => (b.depth || 5) - (a.depth || 5))

      if (activeEntries.length > 0) {
        systemPrompt += '\n\n[世界书设定]\n' + activeEntries.map(e => {
          const prefix = (e.depth || 5) >= 7 ? '[重要] ' : ''
          return prefix + e.content
        }).join('\n')
      }
    }


    // 4. 时间戳
    if (settings.showTimestamp) {
      const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      systemPrompt += `\n\n[当前时间] ${timeStr}`
    }

    // 5. 聊天模式提示词
    if (settings.chatMode) {
      systemPrompt += '\n\n[聊天模式] 你现在处于微信聊天模式。请像真人发微信一样，把你想说的内容分成多条消息发送。每条消息之间用单独一行的 --- 分隔。每条消息应该简短自然，像真人聊天那样。不要在一条消息里说太多内容。'
    }

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt })
    }

    // 5. 总结
    const summaries = await db.summaries
      .where('conversationId')
      .equals(conv.id)
      .toArray()

    let summarizedUpToFloor = 0
    if (summaries.length > 0) {
      const latestSummary = summaries.sort((a, b) => b.toFloor - a.toFloor)[0]
      summarizedUpToFloor = latestSummary.toFloor
      apiMessages.push({ role: 'system', content: `[之前对话的总结]\n${latestSummary.content}` })
    }

    // 6. 未被总结且未隐藏的消息
    const visibleMessages = messages.value.filter(m => !m.hidden && m.floor > summarizedUpToFloor)

    // 找到最后一条用户消息的索引
    let lastUserIdx = -1
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }

    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i]
      const apiMsg = { role: msg.role, content: msg.content }
      // 图片理解支持：只在最后一条用户消息中附带图片，历史图片不重复发送
      if (i === lastUserIdx && msg.imageBase64) {
        const imageUrl = msg.imageBase64.startsWith('data:')
          ? msg.imageBase64
          : `data:image/jpeg;base64,${msg.imageBase64}`
        apiMsg.content = [
          { type: 'text', text: msg.content || '请描述这张图片' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
      apiMessages.push(apiMsg)
    }

    return apiMessages
  }

  // 发送消息并获取 AI 回复
  async function sendAndGetReply() {
    const settings = useSettingsStore()

    if (!settings.apiBaseUrl || !settings.apiKey) {
      throw new Error('请先在设置中配置 API 地址和 Key')
    }

    isStreaming.value = true
    streamingContent.value = ''
    abortController.value = new AbortController()

    const apiMessages = await buildApiMessages()

    // 检测是否包含图片（很多中转站不支持图片+流式）
    const hasImage = apiMessages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))

    try {
      let fullContent

      if (hasImage) {
        // 图片请求使用非流式模式，避免中转站不支持导致卡住
        console.log('[Chat] 检测到图片，使用非流式请求')
        streamingContent.value = '正在识别图片...'

        const { chatComplete } = await import('../utils/api')
        const result = await chatComplete({
          baseUrl: settings.apiBaseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          messages: apiMessages
        })
        fullContent = result.content

        if (fullContent) {
          await saveAssistantReply(fullContent)
        }
      } else {
        // 普通文本请求使用流式模式
        fullContent = await streamChat({
          baseUrl: settings.apiBaseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          messages: apiMessages,
          signal: abortController.value.signal,
          onChunk: (chunk, full) => {
            streamingContent.value = full
          },
          onDone: async (content) => {
            if (content) {
              await saveAssistantReply(content)
            }
          },
          onError: (error) => {
            console.error('AI 回复错误:', error)
          }
        })
      }

      return fullContent
    } finally {
      isStreaming.value = false
      streamingContent.value = ''
      abortController.value = null
    }
  }

  // 停止生成
  function stopStreaming() {
    if (abortController.value) {
      abortController.value.abort()
    }
  }

  // 重新生成（删除最后一条 AI 消息，重新请求）
  async function regenerate() {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      await db.messages.delete(lastMsg.id)
      messages.value.pop()
    }
    return await sendAndGetReply()
  }

  // 编辑消息
  async function editMessage(msgId, newContent) {
    await db.messages.update(msgId, { content: newContent })
    const idx = messages.value.findIndex(m => m.id === msgId)
    if (idx !== -1) {
      messages.value[idx].content = newContent
    }
  }

  // 删除消息
  async function deleteMessage(msgId) {
    await db.messages.delete(msgId)
    messages.value = messages.value.filter(m => m.id !== msgId)
  }

  // 隐藏/显示楼层
  async function toggleHideFloor(floor) {
    const msg = messages.value.find(m => m.floor === floor)
    if (msg) {
      const newHidden = !msg.hidden
      await db.messages.update(msg.id, { hidden: newHidden })
      msg.hidden = newHidden
    }
  }

  // 批量隐藏楼层
  async function hideFloorRange(from, to) {
    for (const msg of messages.value) {
      if (msg.floor >= from && msg.floor <= to) {
        await db.messages.update(msg.id, { hidden: true })
        msg.hidden = true
      }
    }
  }

  // 处理指令
  async function processCommand(input) {
    const hideMatch = input.match(/^\/hide\s+(\d+)(?:-(\d+))?$/)
    if (hideMatch) {
      const from = parseInt(hideMatch[1])
      const to = hideMatch[2] ? parseInt(hideMatch[2]) : from
      await hideFloorRange(from, to)
      return true
    }

    const showMatch = input.match(/^\/show\s+(\d+)(?:-(\d+))?$/)
    if (showMatch) {
      const from = parseInt(showMatch[1])
      const to = showMatch[2] ? parseInt(showMatch[2]) : from
      for (const msg of messages.value) {
        if (msg.floor >= from && msg.floor <= to) {
          await db.messages.update(msg.id, { hidden: false })
          msg.hidden = false
        }
      }
      return true
    }

    return false
  }

  // 设置对话专属 AI 头像
  async function setConversationAiAvatar(conversationId, avatarDataUrl) {
    await db.conversations.update(conversationId, { aiAvatar: avatarDataUrl })
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = { ...currentConversation.value, aiAvatar: avatarDataUrl }
    }
  }

  // 清除对话专属 AI 头像
  async function clearConversationAiAvatar(conversationId) {
    await db.conversations.update(conversationId, { aiAvatar: '' })
    if (currentConversation.value && currentConversation.value.id === conversationId) {
      currentConversation.value = { ...currentConversation.value, aiAvatar: '' }
    }
  }

  return {
    currentConversation,
    messages,
    isStreaming,
    streamingContent,
    loadMessages,
    getConversations,
    createConversation,
    deleteConversation,
    addUserMessage,
    addMultiUserMessages,
    sendAndGetReply,
    stopStreaming,
    regenerate,
    editMessage,
    deleteMessage,
    toggleHideFloor,
    hideFloorRange,
    processCommand,
    buildApiMessages,
    setConversationAiAvatar,
    clearConversationAiAvatar
  }
})
