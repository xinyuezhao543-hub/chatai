<template>
  <div id="app-container" :class="themeClass">
    <router-view />
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useSettingsStore } from './stores/settings'

const settingsStore = useSettingsStore()
const themeClass = computed(() => settingsStore.theme === 'dark' ? 'theme-dark' : 'theme-light')

// 初始化时应用自定义字体和气泡样式
onMounted(async () => {
  // 从 IndexedDB 加载字体（优先）
  const fontData = await settingsStore.loadFontFromDb()
  if (fontData) {
    applyCustomFont(fontData)
  } else if (settingsStore.customFontData) {
    // 兼容旧 localStorage 数据：迁移到 IndexedDB
    applyCustomFont(settingsStore.customFontData)
    if (settingsStore.customFontName) {
      await settingsStore.saveFontToDb(settingsStore.customFontData, settingsStore.customFontName)
    }
  }
  applyBubbleStyles()
})

// 监听字体变化
watch(() => settingsStore.customFontData, (val) => {
  if (val) {
    applyCustomFont(val)
  } else {
    const el = document.getElementById('custom-font-style')
    if (el) el.remove()
  }
})

// 监听气泡样式变化
watch(
  () => [
    settingsStore.bubbleUserColor,
    settingsStore.bubbleAiColor,
    settingsStore.bubbleUserTextColor,
    settingsStore.bubbleAiTextColor,
    settingsStore.bubbleRadius,
    settingsStore.fontSize
  ],
  () => applyBubbleStyles(),
  { deep: true }
)

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
    #app-container {
      font-family: 'CustomFont', sans-serif !important;
    }
  `
}

function applyBubbleStyles() {
  let styleEl = document.getElementById('custom-bubble-style')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'custom-bubble-style'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = `
    #app-container {
      --bubble-user: ${settingsStore.bubbleUserColor};
      --bubble-ai: ${settingsStore.bubbleAiColor};
      --bubble-user-text: ${settingsStore.bubbleUserTextColor};
      --bubble-ai-text: ${settingsStore.bubbleAiTextColor};
      font-size: ${settingsStore.fontSize}px;
    }
    #app-container .bubble {
      border-radius: ${settingsStore.bubbleRadius}px;
    }
    #app-container .bubble.user {
      border-bottom-right-radius: 4px;
    }
    #app-container .bubble.assistant {
      border-bottom-left-radius: 4px;
    }
  `
}
</script>

<style scoped>
#app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
