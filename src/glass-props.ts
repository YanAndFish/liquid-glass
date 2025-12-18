import type { CSSProperties, ExtractPublicPropTypes, PropType } from 'vue'

export const glassProps = {
  /** 内容层额外类名 */
  contentClass: {
    type: String,
  },
  /** 内容层样式（内联对象或字符串） */
  contentStyle: {
    type: [String, Object] as PropType<CSSProperties | string>,
  },
  /** 位移强度（对应 SVG feDisplacementMap 的 scale） */
  displacementScale: {
    type: Number,
    default: 45,
  },
  /** 背景模糊强度（px，用于 backdrop-filter） */
  blurPx: {
    type: Number,
    default: 10,
  },
  /** 背景饱和度（%，用于 backdrop-filter） */
  saturation: {
    type: Number,
    default: 140,
  },
  /** 色散强度（越大边缘色差越明显） */
  aberrationIntensity: {
    type: Number,
    default: 2,
  },
  /** 边缘环宽度（px），用于模拟 Apple 风格“厚透镜边缘” */
  edgeRingWidthPx: {
    type: Number,
    default: 16,
  },
  /** 边缘环模糊强度（px），通常小于中心 blur（边缘更“清晰”） */
  edgeBlurPx: {
    type: Number,
    default: 6,
  },
  /** 边缘环饱和度（%，用于让边缘更“晶莹”） */
  edgeSaturation: {
    type: Number,
    default: 170,
  },
  /** 边缘环位移强度（对应 SVG feDisplacementMap 的 scale），通常大于中心 */
  edgeDisplacementScale: {
    type: Number,
    default: 70,
  },
  /** 边缘环色散强度（越大边缘色差越明显） */
  edgeAberrationIntensity: {
    type: Number,
    default: 2.8,
  },
  /** 边缘环内侧过渡宽度（px），0 表示自动（用于让 ring → center 更柔和） */
  edgeInnerFeatherPx: {
    type: Number,
    default: 0,
  },
  /** 调试：仅显示“边缘环区域”的位移贴图（用于观察 ring 区域） */
  debugEdgeRingMap: {
    type: Boolean,
    default: false,
  },
  /** 调试：显示动态生成的法线/位移贴图（不应用到滤镜） */
  debugNormalMap: {
    type: Boolean,
    default: false,
  },
  /** 位移贴图：平坦区大小（0~1，按四边等宽 inset 控制，越大越贴近容器边缘） */
  flatAreaScale: {
    type: Number,
    default: 0.82,
  },
  /** 位移贴图：边缘硬度（越大越硬，过渡越短） */
  edgeHardness: {
    type: Number,
    default: 1,
  },
} as const

export type GlassProps = ExtractPublicPropTypes<typeof glassProps>
