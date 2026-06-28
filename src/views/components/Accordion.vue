<template>
  <div class="accordion">
    <button class="accordion-header" @click="toggle">
      <span>{{ title }}</span>
      <svg class="arrow" :class="{ open }" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1,1 6,6 11,1" />
      </svg>
    </button>
    <transition name="slide">
      <div v-show="open" class="accordion-body">
        <slot />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  defaultOpen: { type: Boolean, default: false }
})

const open = ref(props.defaultOpen)

function toggle() {
  open.value = !open.value
}
</script>

<style scoped>
.accordion {
  margin-bottom: 12px;
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.accordion-header:hover {
  background: var(--bg-hover);
}

.arrow {
  width: 12px;
  height: 8px;
  transition: transform 0.3s ease;
}

.arrow.open {
  transform: rotate(180deg);
}

.accordion-body {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-top: none;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  margin-top: -1px;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
