<template>
  <div class="settings-page">
    <header class="page-header">
      <button class="btn-icon" @click="$router.push('/')">←</button>
      <h1>设置</h1>
    </header>

    <div class="settings-content">
      <!-- API 设置 -->
      <section class="settings-section">
        <h2>主 AI 设置</h2>

        <!-- 预设管理 -->
        <div class="form-group preset-group">
          <label>API 预设</label>
          <div class="preset-row">
            <select class="input preset-select" :value="settings.activePresetId" @change="handlePresetChange($event.target.value)">
              <option value="">-- 未选择预设 --</option>
              <option v-for="p in settings.apiPresets" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button class="btn btn-primary btn-sm" @click="handleSavePreset">💾 保存</button>
          </div>
          <div v-if="settings.activePresetId" class="preset-actions">
            <button class="btn btn-ghost btn-sm" @click="handleUpdatePreset">覆盖当前预设</button>
            <button class="btn btn-ghost btn-sm danger-text" @click="handleDeletePreset">删除预设</button>
          </div>
        </div>

        <div class="form-group">
          <label>API 地址</label>
          <input v-model="settings.apiBaseUrl" class="input" placeholder="https://cc.cwapi.vip/v1" />
          <span class="hint">填写到 /v1 即可，例如 https://cc.cwapi.vip/v1</span>
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input v-model="settings.apiKey" class="input" type="password" placeholder="sk-..." />
        </div>
        <div class="form-group">
          <label>模型</label>
          <select v-model="settings.model" class="input">
            <option v-for="m in settings.availableModels" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>可用模型列表</label>
          <div class="fetch-models-row">
            <button
              class="btn btn-primary"
              :disabled="fetchingModels"
              @click="handleFetchModels"
            >
              {{ fetchingModels ? '拉取中...' : '从中转站拉取模型' }}
            </button>
          </div>
          <p v-if="fetchError" class="error-text">{{ fetchError }}</p>
          <p v-if="fetchSuccess" class="success-text">{{ fetchSuccess }}</p>
          <textarea v-model="modelsText" class="input" rows="4" @blur="updateModels" placeholder="也可手动输入，每行一个模型名"></textarea>
        </div>
      </section>

      <!-- 副 AI 设置 -->
      <section class="settings-section">
        <h2>副 AI 设置（总结用）</h2>
        <div class="form-group">
          <label>API 地址（留空则用主AI地址）</label>
          <input v-model="settings.summaryApiBaseUrl" class="input" placeholder="留空则使用主AI地址" />
        </div>
        <div class="form-group">
          <label>API Key（留空则用主AI Key）</label>
          <input v-model="settings.summaryApiKey" class="input" type="password" placeholder="留空则使用主AI Key" />
        </div>
        <div class="form-group">
          <label>总结模型</label>
          <input v-model="settings.summaryModel" class="input" placeholder="deepseek-chat" />
        </div>
      </section>

      <!-- 外观设置 -->
      <section class="settings-section">
        <h2>外观</h2>
        <div class="form-group">
          <label>主题</label>
          <select v-model="settings.theme" class="input">
            <option value="dark">暗色</option>
            <option value="light">亮色</option>
          </select>
        </div>
        <div class="form-group">
          <label>聊天背景图片（URL 或 base64）</label>
          <input v-model="settings.chatBackground" class="input" placeholder="图片地址或留空" />
          <button class="btn btn-ghost" style="margin-top:8px" @click="pickBackground">选择本地图片</button>
        </div>
        <div class="form-group">
          <label>用户头像</label>
          <div class="avatar-preview">
            <img v-if="settings.userAvatar" :src="settings.userAvatar" class="avatar-img" />
            <span v-else class="avatar-placeholder">👤</span>
            <button class="btn btn-ghost" @click="pickAvatar('user')">选择</button>
            <button v-if="settings.userAvatar" class="btn btn-ghost" @click="settings.userAvatar = ''">清除</button>
          </div>
        </div>
        <div class="form-group">
          <label>AI 头像</label>
          <div class="avatar-preview">
            <img v-if="settings.aiAvatar" :src="settings.aiAvatar" class="avatar-img" />
            <span v-else class="avatar-placeholder">🤖</span>
            <button class="btn btn-ghost" @click="pickAvatar('ai')">选择</button>
            <button v-if="settings.aiAvatar" class="btn btn-ghost" @click="settings.aiAvatar = ''">清除</button>
          </div>
        </div>
      </section>

      <!-- 功能设置 -->
      <section class="settings-section">
        <h2>功能</h2>
        <div class="form-group toggle-group">
          <label>聊天模式（AI回复用符号分隔，像微信多条消息）</label>
          <p style="color:var(--text-sub);font-size:12px;margin:4px 0 0 0">
            开启后AI的回答会被分隔符（---）拆分成多条独立消息显示
          </p>
          <button
            class="toggle-btn"
            :class="{ active: settings.chatMode }"
            @click="settings.chatMode = !settings.chatMode"
          >
            {{ settings.chatMode ? '开' : '关' }}
          </button>
        </div>
        <div class="form-group toggle-group">
          <label>时间戳（AI感知当前时间）</label>
          <button
            class="toggle-btn"
            :class="{ active: settings.showTimestamp }"
            @click="settings.showTimestamp = !settings.showTimestamp"
          >
            {{ settings.showTimestamp ? '开' : '关' }}
          </button>
        </div>
      </section>

      <!-- 字体设置 -->
      <section class="settings-section">
        <h2>字体</h2>
        <div class="form-group">
          <label>自定义字体</label>
          <div class="font-preview" v-if="settings.customFontName">
            <span>当前字体：{{ settings.customFontName }}</span>
            <button class="btn btn-ghost btn-sm" @click="clearFont">清除</button>
          </div>
          <button class="btn btn-ghost" @click="pickFont">{{ settings.customFontName ? '更换字体文件' : '选择字体文件' }}</button>
          <span class="hint">支持 .ttf / .otf / .woff / .woff2 格式</span>
        </div>
        <div class="form-group">
          <label>字体大小：{{ settings.fontSize }}px</label>
          <input type="range" v-model.number="settings.fontSize" min="12" max="24" step="1" class="range-input" />
        </div>
      </section>

      <!-- 气泡自定义 -->
      <section class="settings-section">
        <h2>气泡样式</h2>
        <div class="form-group">
          <label>圆角大小：{{ settings.bubbleRadius }}px</label>
          <input type="range" v-model.number="settings.bubbleRadius" min="0" max="24" step="2" class="range-input" />
        </div>
        <div class="color-grid">
          <div class="form-group">
            <label>用户气泡颜色</label>
            <input type="color" v-model="settings.bubbleUserColor" class="color-input" />
          </div>
          <div class="form-group">
            <label>用户文字颜色</label>
            <input type="color" v-model="settings.bubbleUserTextColor" class="color-input" />
          </div>
          <div class="form-group">
            <label>AI 气泡颜色</label>
            <input type="color" v-model="settings.bubbleAiColor" class="color-input" />
          </div>
          <div class="form-group">
            <label>AI 文字颜色</label>
            <input type="color" v-model="settings.bubbleAiTextColor" class="color-input" />
          </div>
        </div>
        <div class="bubble-preview">
          <div class="preview-label">预览</div>
          <div class="preview-bubble user-preview" :style="{ background: settings.bubbleUserColor, color: settings.bubbleUserTextColor, borderRadius: settings.bubbleRadius + 'px', fontSize: settings.fontSize + 'px' }">你好呀！</div>
          <div class="preview-bubble ai-preview" :style="{ background: settings.bubbleAiColor, color: settings.bubbleAiTextColor, borderRadius: settings.bubbleRadius + 'px', fontSize: settings.fontSize + 'px' }">你好！有什么可以帮你的吗？</div>
        </div>
        <button class="btn btn-ghost" style="width:100%;margin-top:12px" @click="resetBubbleStyle">恢复默认气泡样式</button>
      </section>

      <!-- 角色 & 世界书管理 -->
      <section class="settings-section">
        <h2>管理</h2>
        <button class="btn btn-ghost" style="width:100%" @click="$router.push('/character')">👤 管理角色设定</button>
        <button class="btn btn-ghost" style="width:100%;margin-top:8px" @click="$router.push('/worldbook')">📖 管理世界书</button>
      </section>
    </div>

    <!-- 隐藏文件输入 -->
    <input type="file" ref="fileInput" accept="image/*" style="display:none" @change="onFileSelected" />
    <input type="file" ref="fontInput" accept=".ttf,.otf,.woff,.woff2" style="display:none" @change="onFontSelected" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { fetchModels } from '../utils/api'

const settings = useSettingsStore()
const fileInput = ref(null)
const fontInput = ref(null)
const fileTarget = ref('')

const modelsText = ref(settings.availableModels.join('\n'))
const fetchingModels = ref(false)
const fetchError = ref('')
const fetchSuccess = ref('')

async function handleFetchModels() {
  if (!settings.apiBaseUrl || !settings.apiKey) {
    fetchError.value = '请先填写 API 地址和 API Key'
    fetchSuccess.value = ''
    return
  }

  fetchingModels.value = true
  fetchError.value = ''
  fetchSuccess.value = ''

  try {
    const models = await fetchModels({
      baseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey
    })

    if (models.length === 0) {
      fetchError.value = '未获取到模型列表，请检查 API 地址是否正确'
      return
    }

    settings.availableModels = models
    modelsText.value = models.join('\n')
    fetchSuccess.value = `成功拉取 ${models.length} 个模型`

    // 如果当前选中的模型不在列表中，自动切换到第一个
    if (!models.includes(settings.model)) {
      settings.model = models[0]
    }
  } catch (err) {
    fetchError.value = err.message || '拉取失败，请检查网络和配置'
  } finally {
    fetchingModels.value = false
  }
}

function updateModels() {
  const models = modelsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (models.length > 0) {
    settings.availableModels = models
  }
}

function pickBackground() {
  fileTarget.value = 'background'
  fileInput.value?.click()
}

function pickAvatar(type) {
  fileTarget.value = type
  fileInput.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file) return

  // 保存当前 target，防止异步回调时值变化
  const target = fileTarget.value

  const reader = new FileReader()
  reader.onload = (event) => {
    const dataUrl = event.target.result
    if (target === 'background') {
      settings.chatBackground = dataUrl
    } else if (target === 'user') {
      settings.userAvatar = dataUrl
    } else if (target === 'ai') {
      settings.aiAvatar = dataUrl
    }
  }
  reader.readAsDataURL(file)
  // 延迟清除，避免某些浏览器/WebView中 File 对象被提前回收
  setTimeout(() => { e.target.value = '' }, 100)
}

// 预设管理
function handlePresetChange(presetId) {
  if (presetId) {
    settings.loadPreset(presetId)
    // 同步模型文本
    modelsText.value = settings.availableModels.join('\n')
  } else {
    settings.activePresetId = ''
  }
}

function handleSavePreset() {
  const name = prompt('请输入预设名称：')
  if (!name || !name.trim()) return
  settings.saveAsPreset(name.trim())
}

function handleUpdatePreset() {
  if (!confirm('确定要用当前配置覆盖此预设吗？')) return
  settings.updatePreset(settings.activePresetId)
}

function handleDeletePreset() {
  if (!confirm('确定要删除此预设吗？')) return
  settings.deletePreset(settings.activePresetId)
}

// 字体管理
function pickFont() {
  fontInput.value?.click()
}

function onFontSelected(e) {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    settings.customFontData = event.target.result
    settings.customFontName = file.name
    applyCustomFont(event.target.result)
  }
  reader.readAsDataURL(file)
  setTimeout(() => { e.target.value = '' }, 100)
}

function clearFont() {
  settings.customFontData = ''
  settings.customFontName = ''
  // 移除自定义字体
  const existing = document.getElementById('custom-font-style')
  if (existing) existing.remove()
}

function applyCustomFont(dataUrl) {
  let styleEl = document.getElementById('custom-font-style')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'custom-font-style'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `
    @font-face {
      font-family: 'CustomFont';
      src: url('${dataUrl}');
    }
  `
}

// 气泡样式重置
function resetBubbleStyle() {
  settings.bubbleUserColor = '#2b5278'
  settings.bubbleAiColor = '#1e1e2e'
  settings.bubbleUserTextColor = '#ffffff'
  settings.bubbleAiTextColor = '#e0e0e0'
  settings.bubbleRadius = 16
  settings.fontSize = 15
}
</script>

<style scoped>
.settings-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.page-header h1 {
  font-size: 18px;
  font-weight: 600;
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

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.toggle-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.toggle-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.avatar-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.fetch-models-row {
  margin-bottom: 8px;
}

.error-text {
  font-size: 12px;
  color: #f56c6c;
  margin: 6px 0;
}

.success-text {
  font-size: 12px;
  color: #67c23a;
  margin: 6px 0;
}

/* 预设样式 */
.preset-group {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 16px;
}

.preset-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preset-select {
  flex: 1;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  white-space: nowrap;
}

.preset-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.danger-text {
  color: #f56c6c !important;
}

/* 字体设置 */
.font-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.range-input {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-secondary);
  border-radius: 3px;
  outline: none;
  margin-top: 8px;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

/* 气泡样式 */
.color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.color-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-input);
  cursor: pointer;
  padding: 2px;
}

.bubble-preview {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.preview-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.preview-bubble {
  padding: 10px 14px;
  margin-bottom: 8px;
  max-width: 80%;
  word-break: break-word;
}

.user-preview {
  margin-left: auto;
}

.ai-preview {
  margin-right: auto;
}
</style>
