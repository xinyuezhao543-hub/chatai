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

        <button class="btn btn-primary" style="width:100%;margin-bottom:16px" @click="addEntry">+ 新建条目</button>

        <div v-for="entry in entries" :key="entry.id" class="entry-card">
          <div class="entry-header" @click="toggleExpand(entry.id)">
            <span class="entry-title">{{ entry.title || '未命名条目' }}</span>
            <div class="entry-badges">
              <span v-if="entry.enabled" class="badge active">常驻</span>
              <span v-if="entry.keywords?.length" class="badge">关键词</span>
            </div>
          </div>

          <div v-if="expandedId === entry.id" class="entry-body">
            <div class="form-group">
              <label>条目标题</label>
              <input v-model="entry.title" class="input" @input="debouncedSave(entry)" @blur="saveEntry(entry)" />
            </div>
            <div class="form-group">
              <label>内容</label>
              <textarea v-model="entry.content" class="input" rows="4" @input="debouncedSave(entry)" @blur="saveEntry(entry)"></textarea>
            </div>
            <div class="form-group">
              <label>关键词（逗号分隔，对话中出现关键词时自动激活）</label>
              <input :value="entry.keywords?.join(',')" class="input" @input="updateKeywords(entry, $event)" @blur="updateKeywords(entry, $event)" />
            </div>
            <div class="form-group toggle-group">
              <label>常驻启用（始终激活）</label>
              <button class="toggle-btn" :class="{active: entry.enabled}" @click="toggleEnabled(entry)">
                {{ entry.enabled ? '是' : '否' }}
              </button>
            </div>
            <button class="btn btn-danger" @click="deleteEntry(entry.id)">删除条目</button>
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

// 防抖保存
let saveTimer = null
function debouncedSave(entry) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveEntry(entry), 300)
}

const route = useRoute()
const worldBooks = ref([])
const currentBook = ref(null)
const entries = ref([])
const expandedId = ref(null)

onMounted(async () => {
  worldBooks.value = await db.worldBooks.toArray()
  const id = route.params.id
  if (id) {
    const wb = await db.worldBooks.get(parseInt(id))
    if (wb) await openBook(wb)
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
  entries.value = await db.worldBookEntries.where('worldBookId').equals(wb.id).toArray()
}

async function deleteBook(id) {
  if (!confirm('确定删除？')) return
  await db.worldBookEntries.where('worldBookId').equals(id).delete()
  await db.worldBooks.delete(id)
  worldBooks.value = await db.worldBooks.toArray()
}

async function addEntry() {
  const id = await db.worldBookEntries.add({
    worldBookId: currentBook.value.id,
    title: '',
    content: '',
    keywords: [],
    enabled: false
  })
  entries.value = await db.worldBookEntries.where('worldBookId').equals(currentBook.value.id).toArray()
  expandedId.value = id
}

async function saveEntry(entry) {
  await db.worldBookEntries.update(entry.id, {
    title: entry.title,
    content: entry.content,
    keywords: entry.keywords,
    enabled: entry.enabled
  })
}

function updateKeywords(entry, e) {
  entry.keywords = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
  saveEntry(entry)
}

async function toggleEnabled(entry) {
  entry.enabled = !entry.enabled
  await saveEntry(entry)
}

async function deleteEntry(id) {
  if (!confirm('确定删除条目？')) return
  await db.worldBookEntries.delete(id)
  entries.value = entries.value.filter(e => e.id !== id)
  expandedId.value = null
}

function toggleExpand(id) {
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
</style>
