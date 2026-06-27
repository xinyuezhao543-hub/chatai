<template>
  <div class="chat-page">
    <!-- 顶部栏 -->
    <header class="chat-header">
      <button class="btn-icon" @click="$router.push('/')">←</button>
      <div class="header-title">
        <span>{{ chatStore.currentConversation?.title || '对话' }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-icon" @click="showMenu = !showMenu">⋮</button>
      </div>
    </header>

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="dropdown-menu" @click.self="showMenu = false">
      <div class="menu-content">
        <button @click="handleSummarize">📝 总结对话</button>
        <button @click="showMenu = false; $router.push(`/summary/${chatStore.currentConversation?.id}`)">📋 查看总结</button>
        <button @click="showBatchHide = true; showMenu = false">🙈 批量隐藏</button>
        <button @click="showSearch = true; showMenu = false">🔍 搜索消息</button>
        <button @click="$router.push(`/character/${chatStore.currentConversation?.characterId || ''}`)">👤 角色设定</button>
        <button @click="$router.push(`/worldbook/${chatStore.currentConversation?.worldBookId || ''}`)">📖 世界书</button>
        <button @click="showTokenStats = true">📊 Token 统计</button>
        <button @click="pickConvAiAvatar">🖼️ 修改AI头像</button>
        <button v-if="chatStore.currentConversation?.aiAvatar" @click="handleClearConvAvatar">❌ 清除对话头像</button>
      </div>
    </div>

    <!-- 搜索面板 -->
    <div v-if="showSearch" class="search-panel">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          class="input search-input"
          placeholder="搜索消息内容..."
          @input="doSearch"
          ref="searchInputRef"
        />
        <button class="btn-icon" @click="showSearch = false; searchQuery = ''; searchResults = []">✕</button>
      </div>
      <div v-if="searchResults.length > 0" class="search-results">
        <div
          v-for="result in searchResults"
          :key="result.id"
          class="search-result-item"
          @click="jumpToMessage(result)"
        >
          <span class="search-floor">#{{ result.floor }}</span>
          <span class="search-role">{{ result.role === 'user' ? '👤' : '🤖' }}</span>
          <span class="search-text">{{ result.content.substring(0, 60) }}{{ result.content.length > 60 ? '...' : '' }}</span>
        </div>
      </div>
      <div v-else-if="searchQuery.length > 0" class="search-empty">无匹配结果</div>
    </div>

    <!-- 消息列表 -->
    <div class="messages-container" ref="messagesContainer" :style="backgroundStyle">
      <div class="messages-list">
        <!-- 加载更多按钮 -->
        <div v-if="hasMoreMessages" class="load-more">
          <button class="btn btn-ghost" @click="loadMore">⬆️ 加载更早的 {{ settings.maxVisibleMessages }} 条消息</button>
        </div>

        <div
          v-for="msg in visibleMessages"
          :key="msg.id"
          class="message-wrapper"
          :class="[msg.role, { hidden: msg.hidden, highlighted: msg.id === highlightedMsgId }]"
          :ref="el => { if (msg.id === highlightedMsgId) highlightedEl = el }"
        >
          <!-- 头像 -->
          <div class="avatar">
            <img v-if="msg.role === 'user' && settings.userAvatar" :src="settings.userAvatar" />
            <img v-else-if="msg.role === 'assistant' && currentAiAvatar" :src="currentAiAvatar" />
            <span v-else>{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
          </div>

          <div class="message-content-area">
            <!-- 楼层号和时间 -->
            <div class="message-meta">
              <span class="floor">#{{ msg.floor }}</span>
              <span v-if="settings.showTimestamp" class="timestamp">{{ formatMsgTime(msg.createdAt) }}</span>
              <span v-if="msg.hidden" class="hidden-badge">已隐藏</span>
            </div>

            <!-- 消息气泡 -->
            <div class="bubble" :class="msg.role">
              <!-- 编辑模式 -->
              <div v-if="editingId === msg.id" class="edit-area">
                <textarea v-model="editContent" class="input edit-textarea"></textarea>
                <div class="edit-actions">
                  <button class="btn btn-ghost" @click="cancelEdit">取消</button>
                  <button class="btn btn-primary" @click="saveEdit(msg.id)">保存</button>
                </div>
              </div>
              <!-- 正常显示 -->
              <div v-else>
                <img v-if="msg.imageBase64" :src="msg.imageBase64" class="msg-image" />
                <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
              </div>
            </div>

            <!-- 消息操作 -->
            <div class="message-actions" v-if="editingId !== msg.id">
              <button @click="startEdit(msg)" title="编辑">✏️</button>
              <button @click="deleteMsg(msg.id)" title="删除">🗑️</button>
              <button v-if="msg.role === 'assistant'" @click="handleRegenerate" title="重新生成">🔄</button>
              <button v-if="msg.role === 'user'" @click="handleResend(msg)" title="重发（重新获取AI回复）">🔁</button>
              <button @click="chatStore.toggleHideFloor(msg.floor)" :title="msg.hidden ? '显示' : '隐藏'">
                {{ msg.hidden ? '👁️' : '🙈' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 流式输出中 -->
        <div v-if="chatStore.isStreaming" class="message-wrapper assistant">
          <div class="avatar">
            <img v-if="currentAiAvatar" :src="currentAiAvatar" />
            <span v-else>🤖</span>
          </div>
          <div class="message-content-area">
            <div class="bubble assistant">
              <div class="markdown-body" v-html="renderMarkdown(chatStore.streamingContent || '思考中...')"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-row">
        <button class="btn-icon" @click="pickImage" title="发送图片">🖼️</button>
      <textarea
        ref="inputRef"
        v-model="inputText"
        class="chat-input"
        :placeholder="settings.chatMode ? '输入消息...（Enter换行，Ctrl+Enter发送）' : '输入消息...'"
        rows="1"
        @keydown="handleKeydown"
        @input="autoResize"
      ></textarea>
        <button
          v-if="chatStore.isStreaming"
          class="btn-icon stop-btn"
          @click="chatStore.stopStreaming()"
          title="停止生成"
        >⏹️</button>
        <button v-else class="btn-icon send-btn" @click="handleSendOrChatMessage" title="发送">➤</button>
      </div>
      <!-- 图片预览 -->
      <div v-if="imagePreview" class="image-preview">
        <img :src="imagePreview" />
        <button @click="clearImage">✕</button>
      </div>
    </div>

    <!-- Token 统计弹窗 -->
    <div v-if="showTokenStats" class="modal-overlay" @click.self="showTokenStats = false">
      <div class="modal">
        <h3>Token 统计</h3>
        <p>消息总数：{{ chatStore.messages.length }}</p>
        <p>可见消息：{{ chatStore.messages.filter(m => !m.hidden).length }}</p>
        <p>预估 Token：约 {{ estimateTokens() }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="showTokenStats = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 批量隐藏弹窗 -->
    <div v-if="showBatchHide" class="modal-overlay" @click.self="showBatchHide = false">
      <div class="modal">
        <h3>批量隐藏/显示消息</h3>
        <div class="batch-form">
          <div class="form-row">
            <div class="form-group">
              <label>起始楼层</label>
              <input v-model.number="batchFrom" type="number" class="input" min="1" />
            </div>
            <div class="form-group">
              <label>结束楼层</label>
              <input v-model.number="batchTo" type="number" class="input" min="1" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="doBatchHide(true)">🙈 隐藏范围</button>
            <button class="btn btn-ghost" @click="doBatchHide(false)">👁️ 显示范围</button>
            <button class="btn btn-primary" @click="showBatchHide = false">关闭</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏文件输入 -->
    <input type="file" ref="fileInput" accept="image/*" style="display:none" @change="onImageSelected" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { useSettingsStore } from '../stores/settings'
import { renderMarkdown } from '../utils/markdown'

const route = useRoute()
const chatStore = useChatStore()
const settings = useSettingsStore()

// 当前对话的 AI 头像（优先使用对话专属的，然后回退到全局设置）
const currentAiAvatar = computed(() => {
  if (chatStore.currentConversation?.aiAvatar) {
    return chatStore.currentConversation.aiAvatar
  }
  return settings.aiAvatar
})

const inputText = ref('')
const messagesContainer = ref(null)
const inputRef = ref(null)
const fileInput = ref(null)
const editingId = ref(null)
const editContent = ref('')
const imagePreview = ref(null)
const imageBase64 = ref(null)
const showMenu = ref(false)
const showTokenStats = ref(false)
const showBatchHide = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchInputRef = ref(null)
const highlightedMsgId = ref(null)
const highlightedEl = ref(null)
const batchFrom = ref(1)
const batchTo = ref(50)

// 消息分页
const visibleCount = ref(settings.maxVisibleMessages)
const hasMoreMessages = computed(() => chatStore.messages.length > visibleCount.value)
const visibleMessages = computed(() => {
  const msgs = chatStore.messages
  if (msgs.length <= visibleCount.value) return msgs
  return msgs.slice(msgs.length - visibleCount.value)
})

const backgroundStyle = ref({})

// 草稿持久化
const draftKey = computed(() => `draft_${route.params.id}`)

onMounted(async () => {
  const conversationId = parseInt(route.params.id)
  await chatStore.loadMessages(conversationId)

  // 恢复草稿
  const savedDraft = localStorage.getItem(draftKey.value)
  if (savedDraft) {
    inputText.value = savedDraft
    nextTick(autoResize)
  }

  scrollToBottom()

  if (settings.chatBackground) {
    backgroundStyle.value = {
      backgroundImage: `url(${settings.chatBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
})

// 自动保存草稿
watch(inputText, (val) => {
  if (val.trim()) {
    localStorage.setItem(draftKey.value, val)
  } else {
    localStorage.removeItem(draftKey.value)
  }
})

// 监听消息变化自动滚动
watch(() => chatStore.messages.length, () => {
  nextTick(scrollToBottom)
})

watch(() => chatStore.streamingContent, () => {
  nextTick(scrollToBottom)
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 处理单行发送（普通模式）
async function handleSend(e) {
  if (e) e.preventDefault()
  const text = inputText.value.trim()
  if (!text && !imageBase64.value) return

  // 检查是否是指令
  if (text.startsWith('/')) {
    const handled = await chatStore.processCommand(text)
    if (handled) {
      inputText.value = ''
      return
    }
  }

  // 先捕获图片数据再清除UI
  const currentImage = imageBase64.value
  inputText.value = ''
  clearImage()
  resetInputHeight()

  try {
    await chatStore.addUserMessage(text, currentImage)
    await chatStore.sendAndGetReply()

    // 检查是否需要自动总结（每50楼）
    const currentFloor = chatStore.messages.length
    if (currentFloor > 0 && currentFloor % 50 === 0) {
      handleAutoSummarize()
    }
  } catch (error) {
    alert(error.message)
  }
}

// 处理聊天模式（chatMode开启）的多行发送
async function handleSendInChatMode(e) {
  if (e) e.preventDefault()
  const text = inputText.value.trim()
  if (!text) return

  // 检查是否是指令（允许按 Ctrl+Enter 发送多个指令）
  const lines = text.trim().split('\n').filter(l => l.trim())
  const isAllCommands = lines.every(l => l.trim().startsWith('/'))

  // 先捕获图片数据再清除UI
  const currentImage = imageBase64.value
  inputText.value = ''
  clearImage()
  resetInputHeight()

  try {
    const thisImage = currentImage

    // 如果是纯指令，直接按原样发送给 AI（作为一条消息）而不是解析
    if (isAllCommands && lines.every(l => l.trim().startsWith('/'))) {
      await chatStore.addUserMessage(text, thisImage)
      await chatStore.sendAndGetReply()
    } else {
      // 多行文本：拆成多条独立消息发送
      await chatStore.addMultiUserMessages(text)
      await chatStore.sendAndGetReply()

      // 检查是否需要自动总结（每50楼）
      const currentFloor = chatStore.messages.length
      if (currentFloor > 0 && currentFloor % 50 === 0) {
        handleAutoSummarize()
      }
    }
  } catch (error) {
    alert(error.message)
  }
}

// 统一处理输入框按键事件
function handleKeydown(e) {
  if (e.key !== 'Enter') return

  if (settings.chatMode) {
    // 聊天模式：Ctrl+Enter = 发送（多行拆分），普通 Enter = 换行
    if (e.ctrlKey) {
      e.preventDefault()
      handleSendInChatMode(e)
    }
    // 普通 Enter 不阻止默认行为，允许换行
  } else {
    // 普通模式：Enter = 换行，点按钮发送
    // 不阻止，让 textarea 保持默认的换行行为
  }
}

// 发送按钮点击（根据模式自动选择）
function handleSendOrChatMessage() {
  if (settings.chatMode) {
    handleSendInChatMode()
  } else {
    handleSend()
  }
}

async function handleRegenerate() {
  try {
    await chatStore.regenerate()
  } catch (error) {
    alert(error.message)
  }
}

// 重发最后一条用户消息（AI 回复失败时使用）
async function handleResend(userMsg) {
  try {
    // 如果最后一条是 AI 消息（部分回复），先删除它
    const lastMsg = chatStore.messages[chatStore.messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.floor > userMsg.floor) {
      await chatStore.deleteMessage(lastMsg.id)
    }
    await chatStore.retryLastResponse()
  } catch (error) {
    alert(error.message)
  }
}

function startEdit(msg) {
  editingId.value = msg.id
  editContent.value = msg.content
}

function cancelEdit() {
  editingId.value = null
  editContent.value = ''
}

async function saveEdit(msgId) {
  await chatStore.editMessage(msgId, editContent.value)
  editingId.value = null
  editContent.value = ''
}

async function deleteMsg(msgId) {
  if (confirm('确定删除这条消息吗？')) {
    await chatStore.deleteMessage(msgId)
  }
}

function pickImage() {
  fileInput.value?.click()
}

function onImageSelected(e) {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const dataUrl = event.target.result
    imagePreview.value = dataUrl
    // 压缩图片后存储，避免请求体过大导致API超时
    compressImage(dataUrl, 1024, 0.8).then(compressed => {
      imageBase64.value = compressed
    }).catch(() => {
      // 压缩失败时使用原图
      imageBase64.value = dataUrl
    })
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

// 压缩图片到指定最大尺寸
function compressImage(dataUrl, maxSize = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      // 按比例缩放
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * maxSize / width)
          width = maxSize
        } else {
          width = Math.round(width * maxSize / height)
          height = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed)
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function clearImage() {
  imagePreview.value = null
  imageBase64.value = null
}

function autoResize() {
  const el = inputRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
}

function resetInputHeight() {
  const el = inputRef.value
  if (el) {
    el.style.height = 'auto'
  }
}

async function handleSummarize() {
  showMenu.value = false
  if (!confirm('确定要总结当前对话吗？这将使用副AI进行总结。')) return

  try {
    const { chatComplete } = await import('../utils/api')
    const settingsStore = useSettingsStore()

    const baseUrl = settingsStore.summaryApiBaseUrl || settingsStore.apiBaseUrl
    const apiKey = settingsStore.summaryApiKey || settingsStore.apiKey
    const model = settingsStore.summaryModel

    const visibleMessages = chatStore.messages.filter(m => !m.hidden)
    const chatText = visibleMessages.map(m => `[${m.role === 'user' ? '用户' : 'AI'}] ${m.content}`).join('\n')

    const result = await chatComplete({
      baseUrl,
      apiKey,
      model,
      messages: [
        { role: 'system', content: '你是一个总结助手。请将以下对话内容进行精炼总结，保留重要信息、人物关系、事件进展和关键细节。总结应当简洁但完整。' },
        { role: 'user', content: `请总结以下对话：\n\n${chatText}` }
      ]
    })

    // 保存总结
    const { default: db } = await import('../db')
    const maxFloor = Math.max(...visibleMessages.map(m => m.floor))
    await db.summaries.add({
      conversationId: chatStore.currentConversation.id,
      content: result.content,
      fromFloor: 1,
      toFloor: maxFloor,
      createdAt: Date.now()
    })

    alert('总结完成！旧消息将不再发送给AI，但仍可在聊天中查看。')
  } catch (error) {
    alert('总结失败：' + error.message)
  }
}

async function handleAutoSummarize() {
  try {
    const { chatComplete } = await import('../utils/api')
    const settingsStore = useSettingsStore()

    const baseUrl = settingsStore.summaryApiBaseUrl || settingsStore.apiBaseUrl
    const apiKey = settingsStore.summaryApiKey || settingsStore.apiKey
    const model = settingsStore.summaryModel

    if (!baseUrl || !apiKey) return

    const visibleMessages = chatStore.messages.filter(m => !m.hidden)
    const chatText = visibleMessages.map(m => `[${m.role === 'user' ? '用户' : 'AI'}] ${m.content}`).join('\n')

    const result = await chatComplete({
      baseUrl,
      apiKey,
      model,
      messages: [
        { role: 'system', content: '你是一个总结助手。请将以下对话内容进行精炼总结，保留重要信息、人物关系、事件进展和关键细节。' },
        { role: 'user', content: `请总结以下对话：\n\n${chatText}` }
      ]
    })

    const { default: db } = await import('../db')
    const maxFloor = Math.max(...visibleMessages.map(m => m.floor))
    await db.summaries.add({
      conversationId: chatStore.currentConversation.id,
      content: result.content,
      fromFloor: 1,
      toFloor: maxFloor,
      createdAt: Date.now()
    })
  } catch (error) {
    console.error('自动总结失败:', error)
  }
}

function estimateTokens() {
  const visibleMessages = chatStore.messages.filter(m => !m.hidden)
  const totalChars = visibleMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  // 粗略估算：中文约1.5字符/token，英文约4字符/token
  return Math.round(totalChars * 0.7)
}

function formatMsgTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 选择对话专属 AI 头像
function pickConvAiAvatar() {
  showMenu.value = false
  // 创建一个临时 file input
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target.result
      const convId = chatStore.currentConversation?.id
      if (convId) {
        await chatStore.setConversationAiAvatar(convId, dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

// 清除对话专属 AI 头像（回退使用全局头像）
async function handleClearConvAvatar() {
  showMenu.value = false
  const convId = chatStore.currentConversation?.id
  if (convId) {
    await chatStore.clearConversationAiAvatar(convId)
  }
}

// 加载更多消息
function loadMore() {
  visibleCount.value += settings.maxVisibleMessages
}

// 搜索消息
function doSearch() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    searchResults.value = []
    return
  }
  searchResults.value = chatStore.messages.filter(m =>
    m.content && m.content.toLowerCase().includes(q)
  )
}

// 跳转到消息
function jumpToMessage(msg) {
  showSearch.value = false
  searchQuery.value = ''
  searchResults.value = []

  // 确保消息在可见范围内
  const idx = chatStore.messages.findIndex(m => m.id === msg.id)
  if (idx >= 0) {
    const neededCount = chatStore.messages.length - idx
    if (neededCount > visibleCount.value) {
      visibleCount.value = neededCount + 10
    }
  }

  highlightedMsgId.value = msg.id
  nextTick(() => {
    if (highlightedEl.value) {
      highlightedEl.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setTimeout(() => { highlightedMsgId.value = null }, 2000)
  })
}

// 批量隐藏/显示
async function doBatchHide(hide) {
  const from = Math.min(batchFrom.value, batchTo.value)
  const to = Math.max(batchFrom.value, batchTo.value)
  await chatStore.batchHideFloors(from, to, hide)
  showBatchHide.value = false
}
</script>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
  gap: 12px;
  z-index: 10;
}

.header-title {
  flex: 1;
  font-weight: 600;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--text-primary);
}

.btn-icon:hover {
  background: var(--bg-input);
}

/* 下拉菜单 */
.dropdown-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
}

.menu-content {
  position: absolute;
  top: 56px;
  right: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 8px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.menu-content button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
}

.menu-content button:hover {
  background: var(--bg-input);
}

/* 消息列表 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-wrapper {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message-wrapper.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-wrapper.assistant {
  align-self: flex-start;
}

.message-wrapper.hidden {
  opacity: 0.4;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-content-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 0 4px;
}

.hidden-badge {
  background: var(--warning);
  color: #000;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  word-break: break-word;
  max-width: 100%;
}

.bubble.user {
  background: var(--bubble-user);
  color: var(--bubble-user-text);
  border-bottom-right-radius: 4px;
}

.bubble.assistant {
  background: var(--bubble-ai);
  color: var(--bubble-ai-text);
  border-bottom-left-radius: 4px;
}

.message-actions {
  display: flex;
  gap: 4px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-wrapper:hover .message-actions {
  opacity: 1;
}

.msg-image {
  max-width: 100%;
  max-height: 240px;
  border-radius: 10px;
  margin-bottom: 8px;
  display: block;
}

.message-actions button {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.message-actions button:hover {
  background: var(--bg-input);
}

/* 编辑区域 */
.edit-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-textarea {
  min-height: 60px;
  font-size: 14px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 输入区域 */
.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  resize: none;
  max-height: 120px;
  line-height: 1.4;
}

.chat-input:focus {
  border-color: var(--primary);
}

.send-btn {
  color: var(--primary);
  font-size: 20px;
}

.stop-btn {
  color: var(--danger);
  font-size: 20px;
}

/* 图片预览 */
.image-preview {
  position: relative;
  display: inline-block;
  margin-top: 8px;
}

.image-preview img {
  max-height: 80px;
  border-radius: 8px;
}

.image-preview button {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--danger);
  color: white;
  border: none;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
}

.modal h3 {
  margin-bottom: 16px;
}

.modal p {
  margin: 8px 0;
  color: var(--text-secondary);
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 搜索面板 */
.search-panel {
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
  z-index: 10;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary);
}

.search-results {
  max-height: 200px;
  overflow-y: auto;
  padding: 0 16px 8px;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.search-result-item:hover {
  background: var(--bg-input);
}

.search-floor {
  color: var(--primary);
  font-weight: 600;
  font-size: 12px;
}

.search-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.search-empty {
  padding: 12px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 8px 0;
}

.load-more .btn {
  font-size: 13px;
}

/* 高亮消息 */
.message-wrapper.highlighted {
  animation: highlight-flash 2s ease;
}

@keyframes highlight-flash {
  0%, 100% { background: transparent; }
  20%, 60% { background: rgba(100, 180, 255, 0.15); border-radius: 12px; }
}

/* 批量隐藏弹窗 */
.batch-form .form-row {
  display: flex;
  gap: 12px;
}

.batch-form .form-group {
  flex: 1;
}

.batch-form .form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-group .input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}
</style>
