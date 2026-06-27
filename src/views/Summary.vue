<template>
  <div class="summary-page">
    <header class="page-header">
      <button class="btn-icon" @click="$router.back()">←</button>
      <h2>对话总结</h2>
      <button class="btn-icon" @click="showAddModal = true" title="手动添加总结">➕</button>
    </header>

    <div class="summary-list">
      <div v-if="summaries.length === 0" class="empty-state">
        <p>暂无总结记录</p>
        <p class="hint">点击右上角 ➕ 手动添加总结，或在对话中使用"总结对话"功能</p>
      </div>

      <div v-for="(summary, index) in summaries" :key="summary.id" class="summary-card">
        <div class="summary-header">
          <span class="summary-title">总结 #{{ index + 1 }}</span>
          <span class="summary-range">楼层 {{ summary.fromFloor }} - {{ summary.toFloor }}</span>
          <span class="summary-time">{{ formatTime(summary.createdAt) }}</span>
        </div>

        <div v-if="editingId === summary.id" class="edit-area">
          <textarea v-model="editContent" class="input edit-textarea" rows="8"></textarea>
          <div class="edit-actions">
            <button class="btn btn-ghost" @click="cancelEdit">取消</button>
            <button class="btn btn-primary" @click="saveEdit(summary.id)">保存</button>
          </div>
        </div>
        <div v-else class="summary-content">
          <pre class="summary-text">{{ summary.content }}</pre>
          <div class="summary-actions">
            <button class="btn btn-ghost" @click="startEdit(summary)">✏️ 编辑</button>
            <button class="btn btn-ghost danger" @click="deleteSummary(summary.id)">🗑️ 删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 手动添加总结弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>手动添加总结</h3>
        <div class="form-group">
          <label>总结内容</label>
          <textarea v-model="newContent" class="input" rows="8" placeholder="事件一：XXX&#10;事件二：XXX&#10;..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>起始楼层</label>
            <input v-model.number="newFromFloor" type="number" class="input" min="1" />
          </div>
          <div class="form-group">
            <label>结束楼层</label>
            <input v-model.number="newToFloor" type="number" class="input" min="1" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" @click="addManualSummary">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import db from '../db'

const route = useRoute()
const conversationId = parseInt(route.params.id)

const summaries = ref([])
const showAddModal = ref(false)
const newContent = ref('')
const newFromFloor = ref(1)
const newToFloor = ref(50)
const editingId = ref(null)
const editContent = ref('')

onMounted(async () => {
  await loadSummaries()
})

async function loadSummaries() {
  const results = await db.summaries
    .where('conversationId')
    .equals(conversationId)
    .toArray()
  summaries.value = results.sort((a, b) => b.createdAt - a.createdAt)
}

async function addManualSummary() {
  if (!newContent.value.trim()) {
    alert('请输入总结内容')
    return
  }
  await db.summaries.add({
    conversationId,
    content: newContent.value.trim(),
    fromFloor: newFromFloor.value,
    toFloor: newToFloor.value,
    createdAt: Date.now()
  })
  newContent.value = ''
  showAddModal.value = false
  await loadSummaries()
}

function startEdit(summary) {
  editingId.value = summary.id
  editContent.value = summary.content
}

function cancelEdit() {
  editingId.value = null
  editContent.value = ''
}

async function saveEdit(id) {
  await db.summaries.update(id, { content: editContent.value })
  editingId.value = null
  editContent.value = ''
  await loadSummaries()
}

async function deleteSummary(id) {
  if (confirm('确定删除这条总结吗？')) {
    await db.summaries.delete(id)
    await loadSummaries()
  }
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<style scoped>
.summary-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.page-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}

.page-header h2 {
  flex: 1;
  font-size: 16px;
  margin: 0;
}

.summary-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state .hint {
  font-size: 13px;
  margin-top: 8px;
  opacity: 0.7;
}

.summary-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.summary-title {
  font-weight: 600;
  font-size: 14px;
}

.summary-range {
  font-size: 12px;
  background: var(--primary);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.summary-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.summary-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  font-family: inherit;
}

.summary-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.edit-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-textarea {
  min-height: 120px;
  font-size: 14px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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

.danger {
  color: var(--danger) !important;
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
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal h3 {
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.input:focus {
  border-color: var(--primary);
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
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
