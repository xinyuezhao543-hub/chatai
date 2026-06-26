<template>
  <div class="character-page">
    <header class="page-header">
      <button class="btn-icon" @click="$router.back()">←</button>
      <h1>角色设定</h1>
      <button class="btn btn-primary" @click="saveCharacter">保存</button>
    </header>

    <div class="page-content">
      <!-- 角色列表（无ID时显示） -->
      <div v-if="!editingCharacter">
        <button class="btn btn-primary" style="width:100%;margin-bottom:16px" @click="createNew">+ 新建角色</button>
        <div v-for="c in characters" :key="c.id" class="list-item" @click="editChar(c)">
          <span>{{ c.name }}</span>
          <button class="btn-icon" @click.stop="deleteChar(c.id)">🗑️</button>
        </div>
        <p v-if="characters.length === 0" class="empty">暂无角色设定</p>
      </div>

      <!-- 编辑角色 -->
      <div v-else>
        <div class="form-group">
          <label>角色名称</label>
          <input v-model="editingCharacter.name" class="input" placeholder="角色名" />
        </div>
        <div class="form-group">
          <label>系统提示词（System Prompt）</label>
          <textarea v-model="editingCharacter.systemPrompt" class="input" rows="12" placeholder="在这里写角色的设定、性格、背景故事..."></textarea>
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
const characters = ref([])
const editingCharacter = ref(null)

onMounted(async () => {
  characters.value = await db.characters.toArray()
  const id = route.params.id
  if (id) {
    const c = await db.characters.get(parseInt(id))
    if (c) editingCharacter.value = { ...c }
  }
})

function createNew() {
  editingCharacter.value = { name: '', systemPrompt: '' }
}

function editChar(c) {
  editingCharacter.value = { ...c }
}

async function saveCharacter() {
  if (!editingCharacter.value) return
  const data = editingCharacter.value
  if (data.id) {
    await db.characters.update(data.id, { name: data.name, systemPrompt: data.systemPrompt })
  } else {
    await db.characters.add({ name: data.name, systemPrompt: data.systemPrompt, createdAt: Date.now() })
  }
  characters.value = await db.characters.toArray()
  editingCharacter.value = null
}

async function deleteChar(id) {
  if (confirm('确定删除？')) {
    await db.characters.delete(id)
    characters.value = await db.characters.toArray()
  }
}
</script>

<style scoped>
.character-page { height:100vh; display:flex; flex-direction:column; background:var(--bg-primary); color:var(--text-primary); }
.page-header { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border); }
.page-header h1 { flex:1; font-size:18px; font-weight:600; }
.btn-icon { background:none; border:none; font-size:18px; cursor:pointer; padding:6px; border-radius:6px; color:var(--text-primary); }
.page-content { flex:1; overflow-y:auto; padding:16px; }
.form-group { margin-bottom:14px; }
.form-group label { display:block; font-size:13px; color:var(--text-secondary); margin-bottom:4px; }
.list-item { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--bg-secondary); border-radius:12px; margin-bottom:8px; cursor:pointer; }
.empty { text-align:center; color:var(--text-secondary); padding:40px; }
</style>
