import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import db from '../db'

export const useSettingsStore = defineStore('settings', () => {
  // 从 localStorage 加载设置
  const loadSetting = (key, defaultValue) => {
    const saved = localStorage.getItem(`settings_${key}`)
    if (saved !== null) {
      try { return JSON.parse(saved) } catch { return saved }
    }
    return defaultValue
  }

  // API 设置
  const apiBaseUrl = ref(loadSetting('apiBaseUrl', ''))
  const apiKey = ref(loadSetting('apiKey', ''))
  const model = ref(loadSetting('model', 'claude-sonnet-4-20250514'))
  const availableModels = ref(loadSetting('availableModels', [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'gpt-4o',
    'gpt-4o-mini',
    'deepseek-chat'
  ]))

  // API 预设
  const apiPresets = ref(loadSetting('apiPresets', []))
  const activePresetId = ref(loadSetting('activePresetId', ''))

  // 副 AI（总结用）
  const summaryApiBaseUrl = ref(loadSetting('summaryApiBaseUrl', ''))
  const summaryApiKey = ref(loadSetting('summaryApiKey', ''))
  const summaryModel = ref(loadSetting('summaryModel', 'deepseek-chat'))

  // 主题
  const theme = ref(loadSetting('theme', 'dark'))

  // 时间戳开关
  const showTimestamp = ref(loadSetting('showTimestamp', true))

  // 聊天模式（微信风格，AI回复用---分隔成多条）
  const chatMode = ref(loadSetting('chatMode', false))

  // 自定义外观
  const chatBackground = ref(loadSetting('chatBackground', ''))
  const userAvatar = ref(loadSetting('userAvatar', ''))
  const aiAvatar = ref(loadSetting('aiAvatar', ''))
  const bubbleStyle = ref(loadSetting('bubbleStyle', 'default'))

  // 自定义字体
  const customFontData = ref(loadSetting('customFontData', ''))
  const customFontName = ref(loadSetting('customFontName', ''))

  // 气泡自定义
  const bubbleUserColor = ref(loadSetting('bubbleUserColor', '#2b5278'))
  const bubbleAiColor = ref(loadSetting('bubbleAiColor', '#1e1e2e'))
  const bubbleUserTextColor = ref(loadSetting('bubbleUserTextColor', '#ffffff'))
  const bubbleAiTextColor = ref(loadSetting('bubbleAiTextColor', '#e0e0e0'))
  const bubbleRadius = ref(loadSetting('bubbleRadius', 16))
  const fontSize = ref(loadSetting('fontSize', 15))

  // 消息分页
  const maxVisibleMessages = ref(loadSetting('maxVisibleMessages', 100))

  // 流式输出开关
  const streamEnabled = ref(loadSetting('streamEnabled', true))

  // 自动保存到 localStorage（字体数据不在这里存，用 IndexedDB）
  const settingsToWatch = {
    apiBaseUrl, apiKey, model, availableModels,
    apiPresets, activePresetId,
    summaryApiBaseUrl, summaryApiKey, summaryModel,
    theme, showTimestamp, chatMode, chatBackground, userAvatar, aiAvatar, bubbleStyle,
    customFontName,
    bubbleUserColor, bubbleAiColor, bubbleUserTextColor, bubbleAiTextColor, bubbleRadius, fontSize,
    maxVisibleMessages, streamEnabled
  }

  Object.entries(settingsToWatch).forEach(([key, refValue]) => {
    watch(refValue, (newVal) => {
      localStorage.setItem(`settings_${key}`, JSON.stringify(newVal))
    }, { deep: true })
  })

  // 预设管理方法
  function saveAsPreset(name) {
    const id = Date.now().toString()
    const preset = {
      id,
      name,
      apiBaseUrl: apiBaseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
      availableModels: [...availableModels.value]
    }
    apiPresets.value = [...apiPresets.value, preset]
    activePresetId.value = id
    return id
  }

  function loadPreset(presetId) {
    const preset = apiPresets.value.find(p => p.id === presetId)
    if (!preset) return
    apiBaseUrl.value = preset.apiBaseUrl
    apiKey.value = preset.apiKey
    model.value = preset.model
    if (preset.availableModels && preset.availableModels.length) {
      availableModels.value = [...preset.availableModels]
    }
    activePresetId.value = presetId
  }

  function updatePreset(presetId) {
    const idx = apiPresets.value.findIndex(p => p.id === presetId)
    if (idx === -1) return
    const updated = {
      ...apiPresets.value[idx],
      apiBaseUrl: apiBaseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
      availableModels: [...availableModels.value]
    }
    const newPresets = [...apiPresets.value]
    newPresets[idx] = updated
    apiPresets.value = newPresets
  }

  function deletePreset(presetId) {
    apiPresets.value = apiPresets.value.filter(p => p.id !== presetId)
    if (activePresetId.value === presetId) {
      activePresetId.value = ''
    }
  }

  // 字体持久化：使用 IndexedDB 存储大文件
  async function saveFontToDb(dataUrl, fontName) {
    await db.settings.put({ id: 'customFont', data: dataUrl })
    customFontData.value = dataUrl
    customFontName.value = fontName
    // 清除 localStorage 中的旧字体数据（迁移）
    localStorage.removeItem('settings_customFontData')
  }

  async function loadFontFromDb() {
    try {
      const record = await db.settings.get('customFont')
      if (record && record.data) {
        customFontData.value = record.data
        return record.data
      }
    } catch (e) {
      console.warn('加载字体失败:', e)
    }
    return ''
  }

  async function clearFont() {
    await db.settings.delete('customFont')
    customFontData.value = ''
    customFontName.value = ''
    localStorage.removeItem('settings_customFontData')
  }

  return {
    apiBaseUrl, apiKey, model, availableModels,
    apiPresets, activePresetId,
    saveAsPreset, loadPreset, updatePreset, deletePreset,
    summaryApiBaseUrl, summaryApiKey, summaryModel,
    theme, showTimestamp, chatMode, chatBackground, userAvatar, aiAvatar, bubbleStyle,
    customFontData, customFontName,
    saveFontToDb, loadFontFromDb, clearFont,
    bubbleUserColor, bubbleAiColor, bubbleUserTextColor, bubbleAiTextColor, bubbleRadius, fontSize,
    maxVisibleMessages, streamEnabled
  }
})
