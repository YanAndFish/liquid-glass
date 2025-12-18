# Liquid Glass

一个基于 Vue 3 的「液态玻璃 / 厚透镜」效果组件库，提供可调参数的玻璃折射、边缘透镜环与边缘高光，并内置调试面板用于快速迭代视觉参数。

## 功能概览

- **液态玻璃折射**：通过动态生成位移贴图 + SVG `feDisplacementMap` 实现折射/扭曲效果
- **厚透镜边缘环**：中心与边缘环参数分离，可分别控制模糊/饱和/位移/色散
- **边缘高光**：支持调整高光角度、强度与颜色
- **调试面板**：`GlassDebugPanel` 可直接联动 `Glass`，或通过 `target` 自动写入 Web Component 属性
- **零额外样式引入**：构建产物会将 CSS 内联进 JS（无需额外 `import css`）

## 安装

```bash
pnpm add @yafh/liquid-glass
```

> 本库以 Vue 3 为核心依赖（`peerDependencies`）。

## 使用（Vue 组件）

最推荐的方式：用同一份 `state` 同时驱动 `Glass` 与 `GlassDebugPanel`。

```vue
<script setup lang="ts">
import { createDefaultGlassDebugState, Glass, GlassDebugPanel } from '@yafh/liquid-glass'
import { reactive } from 'vue'

const state = reactive(createDefaultGlassDebugState())
</script>

<template>
  <Glass v-bind="state">
    <div style="padding: 16px; color: white;">
      Hello Liquid Glass
    </div>
  </Glass>

  <GlassDebugPanel :state="state" />
</template>
```

## 使用（Web Component）

本库也提供 Web Component 入口，适合非 Vue 工程或需要跨框架使用的场景。

```ts
import { registerAll } from '@yafh/liquid-glass/web-component'

registerAll()
```

```html
<liquid-glass id="demo" displacement-scale="70" blur-px="4">
  <div style="padding: 16px; color: white;">
    Hello Liquid Glass
  </div>
</liquid-glass>

<!-- 调试面板会把参数写回到 target 对应元素的 attributes 上 -->
<liquid-glass-debug-panel target="#demo"></liquid-glass-debug-panel>
```

## 组件 API

### `Glass`

用于渲染液态玻璃效果的核心组件。

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `contentClass` | `string` | - | 内容层额外类名 |
| `contentStyle` | `CSSProperties \| string` | - | 内容层样式（内联对象或字符串） |
| `backgroundColor` | `string` | `rgba(255, 255, 255, 0.08)` | 玻璃底色（覆盖在背景之上的半透明色） |
| `shadowLevel` | `number` | `1` | 阴影等级：`0`=无阴影，`1`=默认，`>1` 更强 |
| `displacementScale` | `number` | `70` | 中心位移强度（对应 SVG `feDisplacementMap` 的 `scale`） |
| `blurPx` | `number` | `4` | 中心背景模糊强度（px，用于 `backdrop-filter`） |
| `saturation` | `number` | `140` | 中心背景饱和度（%） |
| `aberrationIntensity` | `number` | `3` | 中心色散强度（边缘色差） |
| `edgeHighlightAngle` | `number` | `135` | 边缘高光角度（deg，遵循 CSS `linear-gradient` 角度：0=上，90=右） |
| `edgeHighlightIntensity` | `number` | `1` | 边缘高光强度：`0`=关闭，`1`=默认，`>1` 更亮 |
| `edgeHighlightColor` | `string` | `#fff` | 边缘高光颜色（CSS 颜色字符串） |
| `edgeRingWidthPx` | `number` | `4` | 边缘环宽度（px） |
| `edgeInnerFeatherPx` | `number` | `0` | 边缘环内侧过渡宽度（px）；`0` 表示自动 |
| `edgeBlurPx` | `number` | `1` | 边缘环模糊强度（px） |
| `edgeSaturation` | `number` | `100` | 边缘环饱和度（%） |
| `edgeDisplacementScale` | `number` | `110` | 边缘环位移强度（scale） |
| `edgeAberrationIntensity` | `number` | `1.7` | 边缘环色散强度 |
| `flatAreaScale` | `number` | `0.64` | 位移贴图：平坦区大小（0~1，越大越贴近容器边缘） |
| `edgeHardness` | `number` | `0.5` | 位移贴图：边缘硬度（越大越硬，过渡越短） |
| `debugNormalMap` | `boolean` | `false` | 调试：显示动态生成的法线/位移贴图（不应用滤镜） |
| `debugEdgeRingMap` | `boolean` | `false` | 调试：仅显示“边缘环区域”的位移贴图（不应用滤镜） |

> Web Component 场景中，以上 Props 对应的 attributes 使用 kebab-case（例如 `shadowLevel` → `shadow-level`，`edgeRingWidthPx` → `edge-ring-width-px`）。布尔值为「存在即 true」。

### `GlassDebugPanel`

用于调试 `Glass` 参数的 UI 组件。

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `state` | `GlassDebugState` | 内部创建 | 调试面板状态（会被面板直接修改；推荐传入 `reactive(createDefaultGlassDebugState())`） |
| `target` | `string` | `''` | 可选：CSS 选择器；传入后会把参数写到目标元素的 attributes 上（推荐用于 Web Component） |
| `title` | `string` | `'Glass 调试'` | 面板标题 |
| `collapsible` | `boolean` | `true` | 是否允许折叠 |

事件：

- `glassDebugChange`：任意参数变更时触发（含 `open`），参数为状态快照
- `reset`：点击“重置”按钮触发，参数为状态快照

### `GlassDebugState`

`GlassDebugState` 大部分字段与 `Glass` Props 一一对应，另外包含：

- `open`：调试面板 UI 展开状态

推荐通过 `createDefaultGlassDebugState()` 创建默认状态（每次调用都会返回新对象，避免意外共享）。

## 贡献指南

### 技术栈

- Vue 3 + TypeScript
- 打包：`tsdown`（并在构建后将 CSS 内联进 JS）
- Lint：ESLint（基于 `@antfu/eslint-config`）

### 开发与检查

```bash
pnpm install
pnpm lint
pnpm type-check
pnpm build
```
