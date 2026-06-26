<template>
  <div class="worldbook-page">
    <header class="page-header">
      <button class="btn-icon" @click="$router.back()">←</button>
      <h1>世界书</h1>
    </header>

    <div class="page-content">
      <!-- 世界书列表 -->
      <div v-if="!currentBook">
        <button class="btn btn-primary" style="width:100%;margin-bottom:16px" @click="createBook">+ 新建世界书</button>
        <div v-for="wb in worldBooks" :key="wb.id" class="list-item" @click="openBook(wb)">
          <span>{{ wb.name }}</span>
          <button class="btn-icon" @click.stop="deleteBook(wb.id)">🗑️</button>
        </div>
        <p v-if="worldBooks.length === 0" class="empty">暂无世界书</p>
      </div>

      <!-- 世界书条目管理 -->
      <div v-else>
        <div class="book-header">
          <h2>{{ currentBook.name }}</h2>
          <button class="btn btn-ghost" @click="currentBook = null">返回列表</button>
        </div>

        <button class="btn btn-primary" style="width:100%;margin-bottom:16px" @click="saveAndAddEntry">+ 新建条目</button>

        <div v-for="entry in entries" :key="entry.id" class="entry-card">
          <div class="entry-header" @click="toggleExpand(entry.id)">
            <span class="entry-title">{{ entry.title || '未命名条目' }}</span>
            <div class="entry-badges">
              <span v-if="entry.enabled" class="badge active">常驻</span>
              <span v-if="entry.keywords?.length" class="badge">关键词</span>
              <span v-if="entry.depth" class="badge">深度</span>
            </div>
          </div>

          <div v-if="expandedId === entry.id" class="entry-body">
            <div class="form-group">
              <label>条目标题</label>
              <input v-model="entry.title" class="input" />
            </div>
            <div class="form-group">
              <label>内容</label>
              <textarea v-model="entry.content" class="input" rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>关键词（逗号分隔，对话中出现关键词时自动激活）</label>
              <input :value="entry.keywords?.join(',')" class="input" @input="updateKeywords(entry, $event)" />
            </div>
            <div class="form-group">
              <label>世界书深度（数字越大，AI越容易注意到这条信息）</label>
              <input type="number" min="1" max="10" :value="entry.depth ?? 5" class="input" @input="updateDepth(entry, $event)" />
              <div class="depth-help">1-3: 低优先级（仅在相关关键词出现时触发）
5: 默认（常规匹配）
7-10: 高优先级（即使无关也优先展示）</div>
            </div>
            <div class="form-group toggle-group">
              <label>常驻启用（始终激活）</label>
              <button class="toggle-btn" :class="{active: entry.enabled}" @click="toggleEnabled(entry)">
                {{ entry.enabled ? '是' : '否' }}
              </button>
            </div>
            <div class="action-buttons">
              <button class="btn btn-primary" @click="doSave(entry)">💾 保存</button>
              <button class="btn btn-danger" @click="deleteEntry(entry.id)">🗑️ 删除</button>
            </div>
            <div v-if="savedId === entry.id" class="save-tip">✅ 已保存</div>
            <div v-if="errorMsg" class="error-tip">{{ errorMsg }}</div>
          </div>
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
const worldBooks = ref([])
const currentBook = ref(null)
const entries = ref([])
const expandedId = ref(null)
const savedId = ref(null)
const errorMsg = ref('')

onMounted(async () => {
  try {
    worldBooks.value = await db.worldBooks.toArray()
    console.log('worldBooks loaded:', worldBooks.value)
    const id = route.params.id
    if (id) {
      const wb = await db.worldBooks.get(parseInt(id))
      console.log('book found:', wb)
      if (wb) await openBook(wb)
    }
  } catch (e) {
    console.error('onMounted error:', e)
    errorMsg.value = '加载失败: ' + e.message
  }
})

async function createBook() {
  const name = prompt('世界书名称：')
  if (!name) return
  await db.worldBooks.add({ name, createdAt: Date.now() })
  worldBooks.value = await db.worldBooks.toArray()
}

async function openBook(wb) {
  currentBook.value = wb
  try {
    const loaded = await db.worldBookEntries.where('worldBookId').equals(wb.id).toArray()
    console.log('entries loaded:', loaded)
    entries.value = loaded
  } catch (e) {
    console.error('openBook error:', e)
    errorMsg.value = '加载条目失败: ' + e.message
  }
}

async function deleteBook(id) {
  if (!confirm('确定删除？')) return
  await db.worldBookEntries.where('worldBookId').equals(id).delete()
  await db.worldBooks.delete(id)
  worldBooks.value = await db.worldBooks.toArray()
}

async function saveAndAddEntry() {
  // 先保存当前正在编辑的条目
  if (expandedId.value) {
    const entry = entries.value.find(e => e.id === expandedId.value)
    if (entry) await saveEntry(entry)
  }
  
  const newEntry = {
    worldBookId: currentBook.value.id,
    title: '',
    content: '',
    keywords: [],
    enabled: false,
    depth: 5
  }
  try {
    const id = await db.worldBookEntries.add(newEntry)
    console.log('added entry id:', id)
    newEntry.id = id
    entries.value.push(newEntry)
    expandedId.value = id
  } catch (e) {
    console.error('add entry error:', e)
    errorMsg.value = '新建失败: ' + e.message
  }
}

async function saveEntry(entry) {
  console.log('saving entry:', entry.id, entry)
  try {
    await db.worldBookEntries.update(entry.id, {
      title: entry.title,
      content: entry.content,
      keywords: entry.keywords,
      enabled: entry.enabled,
      depth: entry.depth
    })
    console.log('saved successfully')
  } catch (e) {
    console.error('save error:', e)
    errorMsg.value = '保存失败: ' + e.message
    throw e
  }
}

async function doSave(entry) {
  try {
    await saveEntry(entry)
    savedId.value = entry.id
    setTimeout(() => { savedId.value = null }, 2000)
    errorMsg.value = ''
  } catch (e) {
    // handled in saveEntry
  }
}

function updateKeywords(entry, e) {
  entry.keywords = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
}

async function updateDepth(entry, e) {
  entry.depth = parseInt(e.target.value) || 5
}

async function toggleEnabled(entry) {
  entry.enabled = !entry.enabled
}

async function deleteEntry(id) {
  if (!confirm('确定删除条目？')) return
  await db.worldBookEntries.delete(id)
  entries.value = entries.value.filter(e => e.id !== id)
  expandedId.value = null
}

async function toggleExpand(id) {
  // 切换前先保存当前编辑中的条目
  if (expandedId.value && expandedId.value !== id) {
    const entry = entries.value.find(e => e.id === expandedId.value)
    if (entry) await saveEntry(entry)
  }
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<style scoped>
.worldbook-page { height:100vh; display:flex; flex-direction:column; background:var(--bg-primary); color:var(--text-primary); }
.page-header { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border); }
.page-header h1 { flex:1; font-size:18px; font-weight:600; }
.btn-icon { background:none; border:none; font-size:18px; cursor:pointer; padding:6px; border-radius:6px; color:var(--text-primary); }
.page-content { flex:1; overflow-y:auto; padding:16px; }
.book-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.book-header h2 { font-size:16px; }
.list-item { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--bg-secondary); border-radius:12px; margin-bottom:8px; cursor:pointer; }
.empty { text-align:center; color:var(--text-secondary); padding:40px; }

.entry-card { background:var(--bg-secondary); border-radius:12px; margin-bottom:8px; overflow:hidden; }
.entry-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; }
.entry-title { font-weight:500; }
.entry-badges { display:flex; gap:6px; }
.badge { font-size:11px; padding:2px 8px; border-radius:10px; background:var(--border); color:var(--text-secondary); }
.badge.active { background:var(--primary); color:white; }
.entry-body { padding:0 16px 16px; }
.form-group { margin-bottom:12px; }
.form-group label { display:block; font-size:12px; color:var(--text-secondary); margin-bottom:4px; }
.toggle-group { display:flex; align-items:center; justify-content:space-between; }
.toggle-btn { padding:4px 12px; border-radius:16px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); cursor:pointer; font-size:12px; }
.toggle-btn.active { background:var(--primary); color:white; border-color:var(--primary); }
.depth-help { font-size:11px; color:var(--text-secondary); margin-top:4px; line-height:1.4; }
.action-buttons { display:flex; gap:10px; margin-top:12px; }
.action-buttons .btn { flex:1; }
.save-tip { font-size:12px; color:#4caf50; margin-top:8px; }
.error-tip { font-size:12px; color:red; margin-top:8px; word-break:break-all; }
</style>
