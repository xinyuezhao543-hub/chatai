<template>
  <div class="chat-list-page">
    <header class="page-header">
      <h1>ChatAI</h1>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="$router.push('/settings')">⚙️</button>
      </div>
    </header>

    <div class="list-content">
      <!-- 新建对话按钮 -->
      <button class="new-chat-btn" @click="showNewDialog = true">
        <span class="plus-icon">+</span>
        <span>新建对话</span>
      </button>

      <!-- 对话列表 -->
      <div class="conversations">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          @click="$router.push(`/chat/${conv.id}`)"
        >
          <div class="conv-info">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-time">{{ formatTime(conv.updatedAt) }}</div>
          </div>
          <button class="delete-btn" @click.stop="confirmDelete(conv)">🗑️</button>
        </div>
      </div>

      <div v-if="conversations.length === 0" class="empty-state">
        <p>还没有对话</p>
        <p class="empty-hint">点击上方按钮开始新对话</p>
      </div>
    </div>

    <!-- 新建对话弹窗 -->
    <div v-if="showNewDialog" class="modal-overlay" @click.self="showNewDialog = false">
      <div class="modal">
        <h3>新建对话</h3>
        <input
          v-model="newTitle"
          class="input"
          placeholder="对话标题"
          @keyup.enter="createChat"
        />
        <div class="form-group">
          <label>角色设定</label>
          <select v-model="selectedCharacter" class="input">
            <option :value="null">无</option>
            <option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>世界书</label>
          <select v-model="selectedWorldBook" class="input">
            <option :value="null">无</option>
            <option v-for="wb in worldBooks" :key="wb.id" :value="wb.id">{{ wb.name }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showNewDialog = false">取消</button>
          <button class="btn btn-primary" @click="createChat">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import db from '../db'

const router = useRouter()
const chatStore = useChatStore()

const conversations = ref([])
const characters = ref([])
const worldBooks = ref([])
const showNewDialog = ref(false)
const newTitle = ref('')
const selectedCharacter = ref(null)
const selectedWorldBook = ref(null)

onMounted(async () => {
  await loadData()
})

async function loadData() {
  conversations.value = await chatStore.getConversations()
  characters.value = await db.characters.toArray()
  worldBooks.value = await db.worldBooks.toArray()
}

async function createChat() {
  const title = newTitle.value.trim() || '新对话'
  const id = await chatStore.createConversation(title, selectedCharacter.value, selectedWorldBook.value)
  showNewDialog.value = false
  newTitle.value = ''
  selectedCharacter.value = null
  selectedWorldBook.value = null
  router.push(`/chat/${id}`)
}

async function confirmDelete(conv) {
  if (confirm(`确定删除对话「${conv.title}」吗？`)) {
    await chatStore.deleteConversation(conv.id)
    await loadData()
  }
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.chat-list-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.page-header h1 {
  font-size: 20px;
  font-weight: 700;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.new-chat-btn {
  width: 100%;
  padding: 14px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--text-primary);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.new-chat-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.plus-icon {
  font-size: 20px;
  font-weight: bold;
}

.conversations {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conv-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.conv-item:hover {
  background: var(--bg-card);
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  margin-top: 8px;
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
  font-size: 18px;
}

.form-group {
  margin-top: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
