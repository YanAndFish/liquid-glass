import type { GlassDebugPanelProps } from './glass-debug-panel.vue'
import type { GlassProps } from './glass.vue'
import { defineCustomElement } from 'vue'
import GlassDebugPanelComponent from './glass-debug-panel.vue'
import GlassComponent from './glass.vue'

/** 默认 Web Component 标签名（必须包含连字符） */
export const LIQUID_GLASS_TAG_NAME = 'liquid-glass'

/** 默认调试面板 Web Component 标签名（必须包含连字符） */
export const LIQUID_GLASS_DEBUG_PANEL_TAG_NAME = 'liquid-glass-debug-panel'

/**
 * `Glass` Web Component 构造器（由 Vue 驱动）。
 *
 * 说明：
 * - 通过 Shadow DOM 隔离样式与结构
 * - 通过 `styles` 注入样式，确保无需额外引入 CSS 文件也能正常显示
 * - 关闭 `inheritAttrs`，避免宿主元素上的非 Props 属性透传到内部根节点
 */
const Glass = defineCustomElement(GlassComponent)
const GlassDebugPanel = defineCustomElement(GlassDebugPanelComponent)

/**
 * 注册 `liquid-glass` Web Component（幂等）。
 * @returns Web Component 构造器
 */
export function register(): CustomElementConstructor {
  if (!customElements.get(LIQUID_GLASS_TAG_NAME))
    customElements.define(LIQUID_GLASS_TAG_NAME, Glass)

  return Glass
}

/**
 * 注册 `liquid-glass-debug-panel` Web Component（幂等）。
 * @returns Web Component 构造器
 */
export function registerDebugPanel(): CustomElementConstructor {
  if (!customElements.get(LIQUID_GLASS_DEBUG_PANEL_TAG_NAME))
    customElements.define(LIQUID_GLASS_DEBUG_PANEL_TAG_NAME, GlassDebugPanel)

  return GlassDebugPanel
}

/**
 * 注册本库提供的所有 Web Components（幂等）。
 * @returns 已注册的构造器列表（顺序与标签名无关）
 */
export function registerAll(): CustomElementConstructor[] {
  return [register(), registerDebugPanel()]
}

// 将新元素类型添加到 Vue 的 GlobalComponents 类型中。
declare module 'vue' {
  interface GlobalComponents {
    [LIQUID_GLASS_TAG_NAME]: typeof GlassComponent
    [LIQUID_GLASS_DEBUG_PANEL_TAG_NAME]: typeof GlassDebugPanelComponent
  }
}

type JSXProps<T> = {
  [K in keyof T]: number extends T[K] ? number | `${number}` : T[K]
}

export type GlassJSXComponent = JSXProps<GlassProps>
export type GlassDebugPanelJSXComponent = JSXProps<GlassDebugPanelProps>
