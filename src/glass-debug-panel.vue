<script setup lang="ts">
import type { ExtractPropTypes } from 'vue'
import type { GlassDebugState } from './glass-debug'
import { watch } from 'vue'
import { createDefaultGlassDebugState } from './glass-debug'

const props = withDefaults(
  defineProps<{
    /**
     * 可选：将调试参数自动应用到目标元素（CSS 选择器）。
     *
     * 推荐用于 Web Component 场景：
     * - `<liquid-glass id="demo" />`
     * - `<liquid-glass-debug-panel target="#demo" />`
     */
    target?: string
    /** 面板标题 */
    title?: string
    /** 是否允许折叠（控制“收起/展开”按钮显示） */
    collapsible?: boolean
  }>(),
  {
    target: '',
    title: 'Glass 调试',
    collapsible: true,
  },
)
const emit = defineEmits<{
  /** 点击“重置” */
  (e: 'reset', value: GlassDebugState): void
}>()

/**
 * 调试面板状态（推荐传入 `reactive(createDefaultGlassDebugState())`）。
 *
 * 说明：
 * - 该对象会被本组件直接修改（滑块/开关会写回这个对象）
 * - 若不传入，则组件内部会创建一份默认状态并自管理
 */

const state = defineModel<GlassDebugState>('state', { default: createDefaultGlassDebugState() })

const open = defineModel<boolean>('open', { default: true })

export type GlassDebugPanelProps = ExtractPropTypes<typeof props>

watch(
  state,
  () => {
    applyStateToTarget({ ...state.value })
  },
  { deep: true },
)

watch(
  () => props.target,
  () => {
    applyStateToTarget({ ...state.value })
  },
  { immediate: true },
)

watch(
  () => state.value.debugNormalMap,
  (enabled) => {
    if (enabled)
      state.value.debugEdgeRingMap = false
  },
)

watch(
  () => state.value.debugEdgeRingMap,
  (enabled) => {
    if (enabled)
      state.value.debugNormalMap = false
  },
)

/** 重置 Glass 调试参数（默认不改变面板展开状态）。 */
function resetGlassDebug() {
  state.value = createDefaultGlassDebugState()
  emit('reset', state.value)
}

/** 切换面板展开/收起。 */
function toggleOpen() {
  if (!props.collapsible)
    return
  open.value = !open.value
}

/** 对目标元素写入数字属性（以 attribute 形式）。 */
function setNumberAttr(target: Element, name: string, value: number) {
  target.setAttribute(name, String(value))
}

/** 对目标元素写入布尔属性（存在即 true，不存在即 false）。 */
function setBooleanAttr(target: Element, name: string, value: boolean) {
  if (value)
    target.setAttribute(name, '')
  else
    target.removeAttribute(name)
}

/** 对目标元素写入字符串属性（空字符串会移除 attribute）。 */
function setStringAttr(target: Element, name: string, value: string) {
  const trimmed = value.trim()
  if (trimmed)
    target.setAttribute(name, trimmed)
  else
    target.removeAttribute(name)
}

/**
 * 将当前调试参数应用到目标元素（仅当 `target` 传入且运行在浏览器环境）。
 * @param next 将要应用的状态快照
 */
function applyStateToTarget(next: GlassDebugState) {
  const selector = props.target?.trim()
  if (!selector)
    return
  if (typeof document === 'undefined')
    return

  const target = document.querySelector(selector)
  if (!target)
    return

  setNumberAttr(target, 'displacement-scale', next.displacementScale)
  setNumberAttr(target, 'blur-px', next.blurPx)
  setNumberAttr(target, 'saturation', next.saturation)
  setNumberAttr(target, 'aberration-intensity', next.aberrationIntensity)
  setStringAttr(target, 'background-color', next.backgroundColor)
  setNumberAttr(target, 'shadow-level', next.shadowLevel)
  setNumberAttr(target, 'edge-highlight-angle', next.edgeHighlightAngle)
  setNumberAttr(target, 'edge-highlight-intensity', next.edgeHighlightIntensity)
  setStringAttr(target, 'edge-highlight-color', next.edgeHighlightColor)
  setNumberAttr(target, 'edge-ring-width-px', next.edgeRingWidthPx)
  setNumberAttr(target, 'edge-blur-px', next.edgeBlurPx)
  setNumberAttr(target, 'edge-saturation', next.edgeSaturation)
  setNumberAttr(target, 'edge-displacement-scale', next.edgeDisplacementScale)
  setNumberAttr(target, 'edge-aberration-intensity', next.edgeAberrationIntensity)
  setNumberAttr(target, 'edge-inner-feather-px', next.edgeInnerFeatherPx)
  setNumberAttr(target, 'flat-area-scale', next.flatAreaScale)
  setNumberAttr(target, 'edge-hardness', next.edgeHardness)

  setBooleanAttr(target, 'debug-normal-map', next.debugNormalMap)
  setBooleanAttr(target, 'debug-edge-ring-map', next.debugEdgeRingMap)
}
</script>

<template>
  <div class="debug-panel" :class="{ open }">
    <div class="debug-header">
      <span class="debug-title">{{ title }}</span>
      <button v-if="collapsible" class="debug-toggle" type="button" @click="toggleOpen">
        {{ open ? '收起' : '展开' }}
      </button>
    </div>

    <div v-if="open" class="debug-body">
      <details class="debug-group" open>
        <summary class="debug-summary">
          中心玻璃
        </summary>
        <div class="debug-group-body">
          <div class="debug-row">
            <label class="debug-label">
              位移 scale <span class="debug-value">{{ state.displacementScale }}</span>
            </label>
            <input
              v-model.number="state.displacementScale"
              class="debug-range"
              type="range"
              min="0"
              max="120"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              模糊 blur(px) <span class="debug-value">{{ state.blurPx }}</span>
            </label>
            <input
              v-model.number="state.blurPx"
              class="debug-range"
              type="range"
              min="0"
              max="40"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              饱和 saturation(%) <span class="debug-value">{{ state.saturation }}</span>
            </label>
            <input
              v-model.number="state.saturation"
              class="debug-range"
              type="range"
              min="50"
              max="300"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              色散 aberration <span class="debug-value">{{ state.aberrationIntensity }}</span>
            </label>
            <input
              v-model.number="state.aberrationIntensity"
              class="debug-range"
              type="range"
              min="0"
              max="6"
              step="0.1"
            >
          </div>
        </div>
      </details>

      <details class="debug-group" open>
        <summary class="debug-summary">
          外观
        </summary>
        <div class="debug-group-body">
          <div class="debug-row">
            <label class="debug-label">
              阴影 level <span class="debug-value">{{ state.shadowLevel.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="state.shadowLevel"
              class="debug-range"
              type="range"
              min="0"
              max="2"
              step="0.05"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              背景色 background
            </label>
            <input
              v-model="state.backgroundColor"
              class="debug-input"
              type="text"
              placeholder="rgba(255, 255, 255, 0.08)"
              autocomplete="off"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              高光角度 angle <span class="debug-value">{{ state.edgeHighlightAngle }}</span>
            </label>
            <input
              v-model.number="state.edgeHighlightAngle"
              class="debug-range"
              type="range"
              min="0"
              max="360"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              高光强度 intensity
              <span class="debug-value">{{ state.edgeHighlightIntensity.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="state.edgeHighlightIntensity"
              class="debug-range"
              type="range"
              min="0"
              max="2"
              step="0.05"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              高光颜色 color
            </label>
            <input
              v-model="state.edgeHighlightColor"
              class="debug-input"
              type="text"
              placeholder="#fff"
              autocomplete="off"
            >
          </div>
        </div>
      </details>

      <details class="debug-group" open>
        <summary class="debug-summary">
          边缘环（厚透镜）
        </summary>
        <div class="debug-group-body">
          <div class="debug-row">
            <label class="debug-label">
              环宽 ring(px) <span class="debug-value">{{ state.edgeRingWidthPx }}</span>
            </label>
            <input
              v-model.number="state.edgeRingWidthPx"
              class="debug-range"
              type="range"
              min="0"
              max="48"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              内侧过渡 feather(px)
              <span class="debug-value">
                {{ state.edgeInnerFeatherPx > 0 ? state.edgeInnerFeatherPx : 'auto' }}
              </span>
            </label>
            <input
              v-model.number="state.edgeInnerFeatherPx"
              class="debug-range"
              type="range"
              min="0"
              max="48"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              环模糊 blur(px) <span class="debug-value">{{ state.edgeBlurPx }}</span>
            </label>
            <input
              v-model.number="state.edgeBlurPx"
              class="debug-range"
              type="range"
              min="0"
              max="30"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              环饱和度 saturation(%) <span class="debug-value">{{ state.edgeSaturation }}</span>
            </label>
            <input
              v-model.number="state.edgeSaturation"
              class="debug-range"
              type="range"
              min="50"
              max="300"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              位移 scale <span class="debug-value">{{ state.edgeDisplacementScale }}</span>
            </label>
            <input
              v-model.number="state.edgeDisplacementScale"
              class="debug-range"
              type="range"
              min="0"
              max="200"
              step="1"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              色散 aberration <span class="debug-value">{{ state.edgeAberrationIntensity }}</span>
            </label>
            <input
              v-model.number="state.edgeAberrationIntensity"
              class="debug-range"
              type="range"
              min="0"
              max="8"
              step="0.1"
            >
          </div>
        </div>
      </details>

      <details class="debug-group">
        <summary class="debug-summary">
          位移贴图
        </summary>
        <div class="debug-group-body">
          <div class="debug-row">
            <label class="debug-label">
              平坦区 flatArea <span class="debug-value">{{ state.flatAreaScale.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="state.flatAreaScale"
              class="debug-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
            >
          </div>

          <div class="debug-row">
            <label class="debug-label">
              边缘硬度 hardness <span class="debug-value">{{ state.edgeHardness.toFixed(2) }}</span>
            </label>
            <input
              v-model.number="state.edgeHardness"
              class="debug-range"
              type="range"
              min="0.2"
              max="4"
              step="0.1"
            >
          </div>
        </div>
      </details>

      <details class="debug-group">
        <summary class="debug-summary">
          调试
        </summary>
        <div class="debug-group-body">
          <label class="debug-check">
            <input v-model="state.debugNormalMap" type="checkbox">
            显示法线/位移贴图（不应用滤镜）
          </label>
          <label class="debug-check">
            <input v-model="state.debugEdgeRingMap" type="checkbox">
            显示边缘环位移贴图（不应用滤镜）
          </label>
        </div>
      </details>

      <div class="debug-actions">
        <button class="debug-btn" type="button" @click="resetGlassDebug">
          重置
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 30;
  width: 280px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(16, 24, 40, 0.62);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.9);
  overflow-x: hidden;
  overflow-y: auto;
  max-height: calc(100vh - 32px);
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.06);
}

.debug-title {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}

.debug-toggle {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.debug-body {
  padding: 12px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.debug-group {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.debug-summary {
  cursor: pointer;
  padding: 8px 10px;
  user-select: none;
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.86);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.04);
}

.debug-summary::-webkit-details-marker {
  display: none;
}

.debug-summary::after {
  content: '▸';
  opacity: 0.8;
  transform: rotate(0deg);
  transition: transform 0.12s ease;
}

.debug-group[open] .debug-summary::after {
  transform: rotate(90deg);
}

.debug-group-body {
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.debug-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-label {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.85rem;
}

.debug-value {
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.debug-range {
  width: 100%;
}

.debug-input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  outline: none;
}

.debug-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.debug-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.85rem;
  user-select: none;
}

.debug-actions {
  display: flex;
  justify-content: flex-end;
}

.debug-btn {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}
</style>
