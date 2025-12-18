/**
 * Glass 调试面板状态（用于驱动 UI 与输出调试参数）。
 *
 * 说明：
 * - 大部分字段与 `Glass` 组件的 Props 一一对应，便于直接 `v-bind` 到 `Glass`
 * - `open` 为面板 UI 状态，仅供面板自身使用（不会应用到 `Glass`）
 */
export interface GlassDebugState {
  /** 位移强度（对应 SVG feDisplacementMap 的 scale） */
  displacementScale: number
  /** 背景模糊强度（px，用于 backdrop-filter） */
  blurPx: number
  /** 背景饱和度（%，用于 backdrop-filter） */
  saturation: number
  /** 色散强度（越大边缘色差越明显） */
  aberrationIntensity: number
  /** 玻璃底色（覆盖在背景之上的半透明色，用于微调整体观感） */
  backgroundColor: string
  /** 阴影等级（0=无阴影，1=默认，>1 更强） */
  shadowLevel: number
  /** 边缘高光角度（deg，遵循 CSS linear-gradient 角度：0=上，90=右） */
  edgeHighlightAngle: number
  /** 边缘高光强度（0=关闭，1=默认，>1 更亮） */
  edgeHighlightIntensity: number
  /** 边缘高光颜色（CSS 颜色字符串） */
  edgeHighlightColor: string
  /** 边缘环宽度（px），用于模拟 Apple 风格“厚透镜边缘” */
  edgeRingWidthPx: number
  /** 边缘环模糊强度（px），通常小于中心 blur（边缘更“清晰”） */
  edgeBlurPx: number
  /** 边缘环饱和度（%，用于让边缘更“晶莹”） */
  edgeSaturation: number
  /** 边缘环位移强度（对应 SVG feDisplacementMap 的 scale），通常大于中心 */
  edgeDisplacementScale: number
  /** 边缘环色散强度（越大边缘色差越明显） */
  edgeAberrationIntensity: number
  /** 边缘环内侧过渡宽度（px），0 表示自动（用于让 ring → center 更柔和） */
  edgeInnerFeatherPx: number
  /** 位移贴图：平坦区大小（0~1，按四边等宽 inset 控制，越大越贴近容器边缘） */
  flatAreaScale: number
  /** 位移贴图：边缘硬度（越大越硬，过渡越短） */
  edgeHardness: number
  /** 调试：显示动态生成的法线/位移贴图（不应用到滤镜） */
  debugNormalMap: boolean
  /** 调试：仅显示“边缘环区域”的位移贴图（用于观察 ring 区域） */
  debugEdgeRingMap: boolean
  /** 是否展开调试面板 */
  open: boolean
}

/**
 * 创建默认调试状态（每次返回新对象，避免被意外共享/污染）。
 * @param overrides 可选覆盖字段
 */
export function createDefaultGlassDebugState(overrides: Partial<GlassDebugState> = {}): GlassDebugState {
  return {
    displacementScale: 70,
    blurPx: 4,
    saturation: 140,
    aberrationIntensity: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowLevel: 1,
    edgeHighlightAngle: 135,
    edgeHighlightIntensity: 1,
    edgeHighlightColor: '#fff',
    edgeRingWidthPx: 4,
    edgeBlurPx: 1,
    edgeSaturation: 100,
    edgeDisplacementScale: 110,
    edgeAberrationIntensity: 1.7,
    edgeInnerFeatherPx: 0,
    flatAreaScale: 0.64,
    edgeHardness: 0.5,
    debugNormalMap: false,
    debugEdgeRingMap: false,
    open: true,
    ...overrides,
  }
}
