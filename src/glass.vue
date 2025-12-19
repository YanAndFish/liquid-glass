<script setup lang="ts">
import type { CSSProperties, ExtractPropTypes } from 'vue'
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 内容层额外类名 */
    contentClass?: string
    /** 内容层样式（内联对象或字符串） */
    contentStyle?: CSSProperties | string
    /** 玻璃底色（覆盖在背景之上的半透明色，用于微调整体观感） */
    backgroundColor?: string
    /** 阴影等级（0=无阴影，1=默认，>1 更强） */
    shadowLevel?: number
    /** 位移强度（对应 SVG feDisplacementMap 的 scale） */
    displacementScale?: number
    /** 背景模糊强度（px，用于 backdrop-filter） */
    blurPx?: number
    /** 背景饱和度（%，用于 backdrop-filter） */
    saturation?: number
    /** 色散强度（越大边缘色差越明显） */
    aberrationIntensity?: number
    /** 边缘高光角度（deg，遵循 CSS linear-gradient 角度：0=上，90=右） */
    edgeHighlightAngle?: number
    /** 边缘高光强度（0=关闭，1=默认，>1 更亮） */
    edgeHighlightIntensity?: number
    /** 边缘高光颜色（CSS 颜色字符串） */
    edgeHighlightColor?: string
    /** 边缘环宽度（px），用于模拟 Apple 风格“厚透镜边缘” */
    edgeRingWidthPx?: number
    /** 边缘环模糊强度（px），通常小于中心 blur（边缘更“清晰”） */
    edgeBlurPx?: number
    /** 边缘环饱和度（%，用于让边缘更“晶莹”） */
    edgeSaturation?: number
    /** 边缘环位移强度（对应 SVG feDisplacementMap 的 scale），通常大于中心 */
    edgeDisplacementScale?: number
    /** 边缘环色散强度（越大边缘色差越明显） */
    edgeAberrationIntensity?: number
    /** 边缘环内侧过渡宽度（px），0 表示自动（用于让 ring → center 更柔和） */
    edgeInnerFeatherPx?: number
    /** 调试：仅显示“边缘环区域”的位移贴图（用于观察 ring 区域） */
    debugEdgeRingMap?: boolean
    /** 调试：显示动态生成的法线/位移贴图（不应用到滤镜） */
    debugNormalMap?: boolean
    /** 位移贴图：平坦区大小（0~1，按四边等宽 inset 控制，越大越贴近容器边缘） */
    flatAreaScale?: number
    /** 位移贴图：边缘硬度（越大越硬，过渡越短） */
    edgeHardness?: number
  }>(),
  {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowLevel: 1,
    displacementScale: 70,
    blurPx: 4,
    saturation: 140,
    aberrationIntensity: 3,
    edgeHighlightAngle: 135,
    edgeHighlightIntensity: 1,
    edgeHighlightColor: '#fff',
    edgeRingWidthPx: 4,
    edgeBlurPx: 1,
    edgeSaturation: 100,
    edgeDisplacementScale: 110,
    edgeAberrationIntensity: 1.7,
    edgeInnerFeatherPx: 0,
    debugEdgeRingMap: false,
    debugNormalMap: false,
    flatAreaScale: 0.64,
    edgeHardness: 0.5,
  },
)

export type GlassProps = ExtractPropTypes<typeof props>

const {
  contentClass,
  contentStyle,
  backgroundColor,
  shadowLevel,
  displacementScale,
  blurPx,
  saturation,
  aberrationIntensity,
  edgeHighlightAngle,
  edgeHighlightIntensity,
  edgeHighlightColor,
  edgeRingWidthPx,
  edgeBlurPx,
  edgeSaturation,
  edgeDisplacementScale,
  edgeAberrationIntensity,
  edgeInnerFeatherPx,
  debugEdgeRingMap,
} = toRefs(props)
const { debugNormalMap } = toRefs(props)
const { flatAreaScale, edgeHardness } = toRefs(props)

/** 二维向量（用于 UV 坐标与位移计算） */
interface Vec2 {
  /** X 分量 */
  x: number
  /** Y 分量 */
  y: number
}

/** 圆角半径（px），分别对应 X/Y 方向（用于适配椭圆圆角，如 `border-radius: 50%`）。 */
interface BorderRadiiPx {
  /** 水平方向圆角半径（px） */
  rx: number
  /** 垂直方向圆角半径（px） */
  ry: number
}

/** 位移函数：输入 UV（0~1），输出新的采样 UV（0~1） */
type DisplacementFragment = (uv: Vec2) => Vec2

/** 动态贴图生成参数 */
interface DisplacementMapOptions {
  /** 输出贴图宽度（CSS 像素） */
  width: number
  /** 输出贴图高度（CSS 像素） */
  height: number
  /** 位移函数（JS 版“片元”逻辑） */
  fragment: DisplacementFragment
}

/** 边缘环遮罩生成参数（用于让 ring 与中心平滑过渡） */
interface EdgeRingMaskOptions {
  /** 输出遮罩宽度（CSS 像素） */
  width: number
  /** 输出遮罩高度（CSS 像素） */
  height: number
  /** 容器圆角（px），分别对应 X/Y 方向 */
  borderRadiusPx: BorderRadiiPx
  /** 边缘环宽度（px） */
  ringWidthPx: number
  /** 内侧过渡宽度（px）：ring → 中心 的柔化区间 */
  innerFeatherPx: number
  /** 外侧过渡宽度（px）：ring → 外侧 的抗锯齿区间 */
  outerFeatherPx: number
}

/**
 * 动态生成位移/法线贴图（DataURL）。
 * 说明：
 * - 输出贴图通道约定：R = X 位移，B = Y 位移（与 feDisplacementMap 的 xChannelSelector/yChannelSelector 对齐）
 * - 在 SVG 管线里，“法线贴图”通常以位移贴图的形式使用
 */
class DisplacementMapGenerator {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private canvasDpi = 1

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.display = 'none'

    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('无法获取 Canvas 2D 上下文')
    }
    this.context = context
  }

  /** 释放内部资源 */
  destroy() {
    this.canvas.remove()
  }

  /**
   * 生成位移贴图并返回 DataURL。
   * @param options 生成参数（尺寸 + 位移函数）
   */
  generate(options: DisplacementMapOptions): string {
    const w = Math.max(1, Math.round(options.width * this.canvasDpi))
    const h = Math.max(1, Math.round(options.height * this.canvasDpi))

    if (this.canvas.width !== w)
      this.canvas.width = w
    if (this.canvas.height !== h)
      this.canvas.height = h

    // 先扫一遍取最大位移用于归一化（避免 scale 失控 / 出现硬边）
    let maxScale = 0
    const rawValues = new Float32Array(w * h * 2)
    let rawIndex = 0

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const uv: Vec2 = { x: x / w, y: y / h }
        const pos = options.fragment(uv)

        const dx = pos.x * w - x
        const dy = pos.y * h - y

        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
        rawValues[rawIndex++] = dx
        rawValues[rawIndex++] = dy
      }
    }

    // 归一化下限，防止过度归一化导致位移几乎不可见
    maxScale = Math.max(1, maxScale)

    const imageData = this.context.createImageData(w, h)
    const data = imageData.data

    rawIndex = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = rawValues[rawIndex++]!
        const dy = rawValues[rawIndex++]!

        // 边缘 2px 内做平滑，防止出现硬边/锯齿
        const edgeDistance = Math.min(x, y, w - x - 1, h - y - 1)
        const edgeFactor = Math.min(1, edgeDistance / 2)

        const smoothedDx = dx * edgeFactor
        const smoothedDy = dy * edgeFactor

        const r = clamp01(smoothedDx / maxScale + 0.5)
        const g = clamp01(smoothedDy / maxScale + 0.5)

        const pixelIndex = (y * w + x) * 4
        data[pixelIndex] = clampByte(r * 255) // R: X 位移
        data[pixelIndex + 1] = clampByte(g * 255) // G: Y 位移（保留）
        data[pixelIndex + 2] = clampByte(g * 255) // B: Y 位移（SVG 选择 B 更兼容）
        data[pixelIndex + 3] = 255
      }
    }

    this.context.putImageData(imageData, 0, 0)
    return this.canvas.toDataURL()
  }
}

/**
 * 动态生成 alpha 遮罩贴图（DataURL）。
 * 用途：给“边缘环层”提供平滑的 ring → center 过渡，避免硬切边显得不真实。
 */
class AlphaMaskGenerator {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private canvasDpi = 1

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.display = 'none'

    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('无法获取 Canvas 2D 上下文')
    }
    this.context = context
  }

  /** 释放内部资源 */
  destroy() {
    this.canvas.remove()
  }

  /**
   * 生成“圆角矩形环形”alpha 遮罩并返回 DataURL。
   * - 遮罩 alpha = 1：显示边缘环层
   * - 遮罩 alpha = 0：隐藏（交给中心玻璃层呈现）
   */
  generateEdgeRingMask(options: EdgeRingMaskOptions): string {
    const w = Math.max(1, Math.round(options.width * this.canvasDpi))
    const h = Math.max(1, Math.round(options.height * this.canvasDpi))

    if (this.canvas.width !== w)
      this.canvas.width = w
    if (this.canvas.height !== h)
      this.canvas.height = h

    const dpiScale = this.canvasDpi
    const ringWidthPx = Math.max(0, options.ringWidthPx * dpiScale)
    const outerFeatherPx = Math.max(0.1, options.outerFeatherPx * dpiScale)
    const innerFeatherPx = Math.max(0.1, options.innerFeatherPx * dpiScale)

    // 以像素中心坐标采样，避免边缘 alias 过强
    const halfWidth = w / 2 - 0.5
    const halfHeight = h / 2 - 0.5

    const outerRadiusX = Math.min(
      Math.max(0, options.borderRadiusPx.rx * dpiScale),
      Math.max(0, halfWidth),
    )
    const outerRadiusY = Math.min(
      Math.max(0, options.borderRadiusPx.ry * dpiScale),
      Math.max(0, halfHeight),
    )
    const outerRadius = Math.min(outerRadiusX, outerRadiusY)
    const isOuterEllipse = outerRadiusX >= halfWidth - 0.5 && outerRadiusY >= halfHeight - 0.5

    const innerHalfWidth = Math.max(1, halfWidth - ringWidthPx)
    const innerHalfHeight = Math.max(1, halfHeight - ringWidthPx)
    const innerRadiusX = Math.min(Math.max(0, outerRadiusX - ringWidthPx), innerHalfWidth)
    const innerRadiusY = Math.min(Math.max(0, outerRadiusY - ringWidthPx), innerHalfHeight)
    const innerRadius = Math.min(innerRadiusX, innerRadiusY)

    const imageData = this.context.createImageData(w, h)
    const data = imageData.data

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - w / 2
        const py = y + 0.5 - h / 2

        let outerSdf = 0
        if (isOuterEllipse)
          outerSdf = ellipseSdfApprox(px, py, halfWidth, halfHeight)
        else if (outerRadius <= 0.001)
          outerSdf = rectSdfLInf(px, py, halfWidth, halfHeight)
        else
          outerSdf = roundedRectSdf(px, py, halfWidth, halfHeight, outerRadius)

        let innerSdf = 0
        if (isOuterEllipse)
          innerSdf = ellipseSdfApprox(px, py, innerHalfWidth, innerHalfHeight)
        else if (innerRadius <= 0.001)
          innerSdf = rectSdfLInf(px, py, innerHalfWidth, innerHalfHeight)
        else
          innerSdf = roundedRectSdf(px, py, innerHalfWidth, innerHalfHeight, innerRadius)

        // outerInside: 形状内为 1，向外做少量 feather 用于抗锯齿
        const outerInside = 1 - smoothStep(0, outerFeatherPx, outerSdf)

        // outsideInner: inner 形状内为 0，向外（ring 方向）平滑过渡到 1
        const outsideInner = smoothStep(-innerFeatherPx, 0, innerSdf)

        const alpha = clamp01(outerInside * outsideInner)

        const pixelIndex = (y * w + x) * 4
        data[pixelIndex] = 255
        data[pixelIndex + 1] = 255
        data[pixelIndex + 2] = 255
        data[pixelIndex + 3] = clampByte(alpha * 255)
      }
    }

    this.context.putImageData(imageData, 0, 0)
    return this.canvas.toDataURL()
  }
}

/** 将数值限制到 [0, 1] */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** 将数值限制到 [0, 255] 的整数 */
function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/** smoothstep 插值（与 shader 常用实现一致） */
function smoothStep(a: number, b: number, t: number): number {
  const normalized = clamp01((t - a) / (b - a))
  return normalized * normalized * (3 - 2 * normalized)
}

/** 2D 向量长度 */
function length2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

/**
 * 圆角矩形 SDF（Signed Distance Field）。
 * @param x 以中心为原点的 X 坐标（px）
 * @param y 以中心为原点的 Y 坐标（px）
 * @param halfWidth 半宽（px）
 * @param halfHeight 半高（px）
 * @param radius 圆角半径（px）
 */
function roundedRectSdf(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const qx = Math.abs(x) - halfWidth + radius
  const qy = Math.abs(y) - halfHeight + radius
  return (
    Math.min(Math.max(qx, qy), 0) + length2(Math.max(qx, 0), Math.max(qy, 0)) - radius
  )
}

/**
 * 轴对齐矩形的“方角距离场”（非严格欧式距离）。
 *
 * 说明：
 * - 标准矩形 SDF 在矩形外侧角点区域使用欧式距离（会形成 1/4 圆弧等距线）。
 * - 本项目会用 SDF 的“距离”驱动 smoothstep 过渡；当圆角为 0 时，欧式等距线会让
 *   位移贴图里“接近 0 位移”的区域看起来像被圆角化（即使真实边界是直角）。
 * - 这里使用切比雪夫距离（L∞）保持过渡等距线为方角矩形，便于做 0 圆角的玻璃。
 */
function rectSdfLInf(x: number, y: number, halfWidth: number, halfHeight: number): number {
  const qx = Math.abs(x) - halfWidth
  const qy = Math.abs(y) - halfHeight
  return Math.max(qx, qy)
}

/**
 * 计算椭圆的近似 SDF（Signed Distance Field）。
 *
 * 说明：
 * - 这是一个“足够平滑”的近似距离（基于隐式方程的一阶近似），用于驱动 smoothstep 过渡。
 * - 对于 `border-radius: 50%` 这类椭圆形容器，可避免用圆角矩形近似导致的“平坦区不跟随大圆角”问题。
 */
function ellipseSdfApprox(x: number, y: number, radiusX: number, radiusY: number): number {
  const a = Math.max(1e-6, radiusX)
  const b = Math.max(1e-6, radiusY)
  const px = Math.abs(x)
  const py = Math.abs(y)

  // 中心点处梯度为 0，直接返回最短轴长度作为“内部距离”
  if (px < 1e-6 && py < 1e-6)
    return -Math.min(a, b)

  const invA = 1 / a
  const invB = 1 / b
  const nx = px * invA
  const ny = py * invB
  const f = nx * nx + ny * ny - 1

  const gx = px * invA * invA
  const gy = py * invB * invB
  const grad = 2 * Math.max(1e-6, Math.sqrt(gx * gx + gy * gy))
  return f / grad
}

/** 解析单个圆角值（px 或 %），并转换为像素值。 */
function parseBorderRadiusTokenPx(token: string, reference: number): number {
  const raw = token.trim()
  if (!raw)
    return 0

  if (raw.endsWith('%')) {
    const percent = Number.parseFloat(raw)
    return Number.isFinite(percent) ? (percent / 100) * reference : 0
  }

  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

/**
 * 从元素的计算样式里读取圆角（px），并取四个角的最小值。
 *
 * 说明：
 * - `getComputedStyle(...).borderTopLeftRadius` 等可能返回：
 *   - `12px`
 *   - `50%`
 *   - `12px 24px`（椭圆圆角：水平/垂直半径）
 * - 这里会把 `%` 按当前元素尺寸换算成像素，并保留 rx/ry 两个方向的半径信息。
 */
function getElementBorderRadiiPx(el: HTMLElement, width: number, height: number): BorderRadiiPx {
  const style = getComputedStyle(el)
  const candidates = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ]

  const radii = candidates
    .map((value) => {
      const normalized = value.replace('/', ' ').trim()
      const parts = normalized.split(/\s+/).filter(Boolean)
      const horizontal = parts[0] ?? '0'
      const vertical = parts[1] ?? parts[0] ?? '0'
      const rx = parseBorderRadiusTokenPx(horizontal, width)
      const ry = parseBorderRadiusTokenPx(vertical, height)
      return {
        rx: Number.isFinite(rx) ? Math.max(0, rx) : 0,
        ry: Number.isFinite(ry) ? Math.max(0, ry) : 0,
      }
    })
    .filter(r => Number.isFinite(r.rx) && Number.isFinite(r.ry))

  if (!radii.length)
    return { rx: 0, ry: 0 }

  return {
    rx: Math.min(...radii.map(r => r.rx)),
    ry: Math.min(...radii.map(r => r.ry)),
  }
}

/** 位移贴图 fragment 参数 */
interface LiquidGlassFragmentParams {
  /** 贴图宽度（px） */
  width: number
  /** 贴图高度（px） */
  height: number
  /** 容器圆角（px），分别对应 X/Y 方向 */
  borderRadiusPx: BorderRadiiPx
  /** 平坦区大小（0~1，越大越贴近容器边缘） */
  flatAreaScale: number
  /** 边缘硬度（越大越硬，过渡越短） */
  edgeHardness: number
}

/**
 * 创建“液态玻璃”位移函数（JS 版 fragment）。
 * 逻辑：以容器的圆角矩形为基准生成一个“平坦区”（位移≈0），并在其外侧用 smoothstep 产生边缘过渡。
 */
function createLiquidGlassFragment(params: LiquidGlassFragmentParams): DisplacementFragment {
  const width = Math.max(1, params.width)
  const height = Math.max(1, params.height)
  const halfWidth = width / 2
  const halfHeight = height / 2

  const borderRadiusRx = Math.min(Math.max(0, params.borderRadiusPx.rx), halfWidth)
  const borderRadiusRy = Math.min(Math.max(0, params.borderRadiusPx.ry), halfHeight)
  const isEllipse = borderRadiusRx >= halfWidth - 0.5 && borderRadiusRy >= halfHeight - 0.5

  // 以“平坦区边界到容器边界的宽度（inset）”作为变量，确保四边宽度一致（不随长宽比改变）
  // flatAreaScale 越大 => inset 越小 => 平坦区越接近容器边缘
  const flatScale = Math.max(0, Math.min(1, params.flatAreaScale))
  const maxInset = Math.max(0, Math.min(halfWidth, halfHeight) - 1)
  const insetPx = (1 - flatScale) * maxInset

  const innerHalfWidth = Math.max(1, halfWidth - insetPx)
  const innerHalfHeight = Math.max(1, halfHeight - insetPx)

  // 平坦区边界圆角：按 flatAreaScale 等比收缩，避免 inset 较大时过早退化为直角
  const cornerRadius = Math.min(borderRadiusRx, borderRadiusRy)
  const rawRadius = Math.max(0, cornerRadius * flatScale)
  const innerRadius = Math.min(rawRadius, innerHalfWidth, innerHalfHeight)

  // 用“平坦区”与容器边缘的 inset 宽度来决定过渡长度（硬度越大，过渡越短）
  const ringThickness = Math.max(0, insetPx)
  const hardness = Math.max(0.1, params.edgeHardness)
  const transitionPx = Math.max(1, ringThickness / hardness)

  const useSharpCornerMetric = !isEllipse && innerRadius <= 0.001

  return (uv) => {
    const x = (uv.x - 0.5) * width
    const y = (uv.y - 0.5) * height

    let distanceToInnerEdge = 0
    if (isEllipse)
      distanceToInnerEdge = ellipseSdfApprox(x, y, innerHalfWidth, innerHalfHeight)
    else if (useSharpCornerMetric)
      distanceToInnerEdge = rectSdfLInf(x, y, innerHalfWidth, innerHalfHeight)
    else
      distanceToInnerEdge = roundedRectSdf(x, y, innerHalfWidth, innerHalfHeight, innerRadius)
    const displacement = smoothStep(transitionPx, 0, distanceToInnerEdge)
    const scaled = smoothStep(0, 1, displacement)

    return {
      x: (x * scaled + halfWidth) / width,
      y: (y * scaled + halfHeight) / height,
    }
  }
}

/** 生成一个相对稳定的 DOM id（避免多实例冲突） */
function createDomId(prefix: string): string {
  const cryptoUuid
    = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${cryptoUuid}`
}

/** 将角度归一化到 [0, 360)。 */
function normalizeAngleDeg(angle: number): number {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

/**
 * 将 CSS linear-gradient 的角度转换为 SVG linearGradient 的 x1/y1/x2/y2（0~1）。
 *
 * 说明：
 * - CSS 角度：0=上，90=右，180=下，270=左
 * - SVG 坐标：x 向右增大，y 向下增大
 * @param angleDeg 渐变角度（deg）
 */
function cssAngleToSvgLinearGradientPoints(angleDeg: number) {
  const safeAngle = Number.isFinite(angleDeg) ? angleDeg : 135
  const rad = normalizeAngleDeg(safeAngle) * Math.PI / 180

  // 将 CSS 角度转换为屏幕坐标向量：0deg 指向上方
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)

  // 将向量延伸到边界，保证渐变从盒子边缘开始到边缘结束
  const denom = Math.max(1e-6, Math.max(Math.abs(dx), Math.abs(dy)))
  const t = 0.5 / denom

  const x1 = clamp01(0.5 - dx * t)
  const y1 = clamp01(0.5 - dy * t)
  const x2 = clamp01(0.5 + dx * t)
  const y2 = clamp01(0.5 + dy * t)
  return { x1, y1, x2, y2 }
}

const filterId = createDomId('glass-filter')
const edgeFilterId = createDomId('glass-edge-filter')
const borderSoftGradientId = createDomId('glass-border-gradient-soft')
const borderStrongGradientId = createDomId('glass-border-gradient-strong')

/** 边缘高光边框宽度（px），用于绘制 SVG stroke */
const highlightBorderWidthPx = 1.5
/** 位移/遮罩贴图可用的最大像素数（约 33MP），超出时直接降级以避免 OOM */
const MAX_PIXEL_BUDGET = 33_000_000

const containerRef = ref<HTMLDivElement | null>(null)
const svgSize = ref({ width: 1, height: 1 })
const normalMapUrl = ref<string>('')
const edgeMaskUrl = ref<string>('')
const borderRadiiPx = ref<BorderRadiiPx>({ rx: 0, ry: 0 })

/** 当前已生成贴图对应的参数（用于避免无意义的重复生成） */
interface NormalMapMeta {
  /** 贴图宽度（px） */
  width: number
  /** 贴图高度（px） */
  height: number
  /** 圆角：水平半径（px） */
  borderRadiusRxPx: number
  /** 圆角：垂直半径（px） */
  borderRadiusRyPx: number
  /** 平坦区大小（0~1） */
  flatAreaScale: number
  /** 边缘硬度 */
  edgeHardness: number
}

const lastNormalMapMeta = ref<NormalMapMeta | null>(null)

/** 当前已生成边缘环遮罩对应的参数（用于避免无意义的重复生成） */
interface EdgeMaskMeta {
  /** 遮罩宽度（px） */
  width: number
  /** 遮罩高度（px） */
  height: number
  /** 圆角：水平半径（px） */
  borderRadiusRxPx: number
  /** 圆角：垂直半径（px） */
  borderRadiusRyPx: number
  /** 边缘环宽度（px） */
  ringWidthPx: number
  /** 内侧过渡宽度（px） */
  innerFeatherPx: number
  /** 外侧过渡宽度（px） */
  outerFeatherPx: number
}

const lastEdgeMaskMeta = ref<EdgeMaskMeta | null>(null)

let generator: DisplacementMapGenerator | null = null
let maskGenerator: AlphaMaskGenerator | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let rafId: number | null = null

/** 读取尺寸并更新贴图（使用 rAF 合并频繁 resize 事件） */
function scheduleResizeUpdate(nextWidth: number, nextHeight: number, force = false) {
  if (rafId !== null)
    cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = null

    const width = Math.max(1, Math.round(nextWidth))
    const height = Math.max(1, Math.round(nextHeight))

    const nextBorderRadiiPx = containerRef.value
      ? getElementBorderRadiiPx(containerRef.value, width, height)
      : borderRadiiPx.value
    borderRadiiPx.value = nextBorderRadiiPx
    svgSize.value = { width, height }

    const nextMeta: NormalMapMeta = {
      width,
      height,
      borderRadiusRxPx: nextBorderRadiiPx.rx,
      borderRadiusRyPx: nextBorderRadiiPx.ry,
      flatAreaScale: flatAreaScale.value,
      edgeHardness: edgeHardness.value,
    }

    const pixelCount = width * height
    const exceedsPixelBudget = pixelCount > MAX_PIXEL_BUDGET

    if (exceedsPixelBudget) {
      edgeMaskUrl.value = ''
      lastEdgeMaskMeta.value = null
      normalMapUrl.value = ''
      lastNormalMapMeta.value = null
      console.warn?.(
        `[glass] 跳过贴图生成：${width}x${height} 超过 ${MAX_PIXEL_BUDGET.toLocaleString()} 像素上限，已降级为纯 backdrop-filter（可能是 CSS 失效导致尺寸异常）。`,
      )
      return
    }

    const lastMeta = lastNormalMapMeta.value
    const isSameMeta
      = lastMeta !== null
        && lastMeta.width === nextMeta.width
        && lastMeta.height === nextMeta.height
        && lastMeta.borderRadiusRxPx === nextMeta.borderRadiusRxPx
        && lastMeta.borderRadiusRyPx === nextMeta.borderRadiusRyPx
        && lastMeta.flatAreaScale === nextMeta.flatAreaScale
        && lastMeta.edgeHardness === nextMeta.edgeHardness

    // 更新边缘环遮罩（用于 ring → center 的平滑过渡）
    if (maskGenerator) {
      const maxInset = Math.max(0, Math.min(width, height) / 2 - 1)
      const ringWidthPx = Math.min(Math.max(0, edgeRingWidthPx.value), maxInset)

      if (ringWidthPx <= 0) {
        edgeMaskUrl.value = ''
        lastEdgeMaskMeta.value = null
      }
      else {
        const innerFeatherPx
          = edgeInnerFeatherPx.value > 0
            ? Math.min(edgeInnerFeatherPx.value, maxInset)
            : Math.max(4, Math.min(24, ringWidthPx * 0.9))
        const outerFeatherPx = 1.5

        const nextMaskMeta: EdgeMaskMeta = {
          width,
          height,
          borderRadiusRxPx: nextBorderRadiiPx.rx,
          borderRadiusRyPx: nextBorderRadiiPx.ry,
          ringWidthPx,
          innerFeatherPx,
          outerFeatherPx,
        }

        const lastMaskMeta = lastEdgeMaskMeta.value
        const isSameMaskMeta
          = lastMaskMeta !== null
            && lastMaskMeta.width === nextMaskMeta.width
            && lastMaskMeta.height === nextMaskMeta.height
            && lastMaskMeta.borderRadiusRxPx === nextMaskMeta.borderRadiusRxPx
            && lastMaskMeta.borderRadiusRyPx === nextMaskMeta.borderRadiusRyPx
            && lastMaskMeta.ringWidthPx === nextMaskMeta.ringWidthPx
            && lastMaskMeta.innerFeatherPx === nextMaskMeta.innerFeatherPx
            && lastMaskMeta.outerFeatherPx === nextMaskMeta.outerFeatherPx

        if (!isSameMaskMeta || !edgeMaskUrl.value) {
          edgeMaskUrl.value = maskGenerator.generateEdgeRingMask({
            width,
            height,
            borderRadiusPx: nextBorderRadiiPx,
            ringWidthPx,
            innerFeatherPx,
            outerFeatherPx,
          })
          lastEdgeMaskMeta.value = nextMaskMeta
        }
      }
    }

    // 更新中心位移贴图
    if (!generator)
      return
    if (!force && isSameMeta && normalMapUrl.value)
      return

    const fragment = createLiquidGlassFragment({
      width,
      height,
      borderRadiusPx: nextBorderRadiiPx,
      flatAreaScale: flatAreaScale.value,
      edgeHardness: edgeHardness.value,
    })
    normalMapUrl.value = generator.generate({ width, height, fragment })
    lastNormalMapMeta.value = nextMeta
  })
}

/**
 * 监听容器/宿主元素的 style/class 变化，并触发贴图重生成。
 *
 * 背景：
 * - 位移贴图需要用到容器的计算圆角（`getComputedStyle(...).borderRadius`）。
 * - 仅靠 `ResizeObserver` 无法捕获“圆角变化但尺寸不变”的场景（例如外部通过 style/class/CSS 变量动态改圆角）。
 * - Web Component 场景中，CSS 变量通常写在 `:host` 上，因此也需要监听宿主元素。
 */
function observeStyleChanges() {
  if (!containerRef.value || typeof MutationObserver === 'undefined')
    return

  mutationObserver = new MutationObserver(() => {
    if (!containerRef.value)
      return
    const rect = containerRef.value.getBoundingClientRect()
    scheduleResizeUpdate(rect.width, rect.height)
  })

  // Vue 组件场景：大概率通过内联 style / class 改 root 容器
  mutationObserver.observe(containerRef.value, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  // Web Component 场景：外部常把 CSS 变量写在 host 上
  const root = containerRef.value.getRootNode()
  if (root instanceof ShadowRoot && root.host) {
    mutationObserver.observe(root.host, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
  }
}

/** SVG 边缘高光描边参数（跟随尺寸/圆角变化） */
const borderStroke = computed(() => {
  const inset = highlightBorderWidthPx / 2
  const width = Math.max(0, svgSize.value.width - inset * 2)
  const height = Math.max(0, svgSize.value.height - inset * 2)
  const rx = Math.max(0, Math.min(borderRadiiPx.value.rx - inset, width / 2))
  const ry = Math.max(0, Math.min(borderRadiiPx.value.ry - inset, height / 2))

  return {
    /** SVG 矩形 X（px） */
    x: inset,
    /** SVG 矩形 Y（px） */
    y: inset,
    /** SVG 矩形宽度（px） */
    width,
    /** SVG 矩形高度（px） */
    height,
    /** SVG 圆角：水平半径（px） */
    rx,
    /** SVG 圆角：垂直半径（px） */
    ry,
    /** 描边宽度（px） */
    strokeWidth: highlightBorderWidthPx,
  }
})

/** 边缘高光参数：角度/颜色/强度（仅影响边框高光，不影响折射层）。 */
const edgeHighlight = computed(() => {
  const { x1, y1, x2, y2 } = cssAngleToSvgLinearGradientPoints(edgeHighlightAngle.value)
  const intensity = Number.isFinite(edgeHighlightIntensity.value)
    ? Math.max(0, edgeHighlightIntensity.value)
    : 1
  const color = edgeHighlightColor.value?.trim() || '#fff'

  return {
    x1,
    y1,
    x2,
    y2,
    color,
    softOpacity: clamp01(0.28 * intensity),
    strongOpacity: clamp01(0.85 * intensity),
  }
})

/** 边缘环宽度（px）：限制到当前尺寸下的可用范围，避免负尺寸或反向圆角 */
const edgeRingWidthSafePx = computed(() => {
  const raw = Math.max(0, edgeRingWidthPx.value)
  const maxInset = Math.max(0, Math.min(svgSize.value.width, svgSize.value.height) / 2 - 1)
  return Math.min(raw, maxInset)
})

/** 边缘环滤镜参数：与中心分离，允许更强折射/更小模糊来模拟“厚透镜边缘” */
const edgeFilterParams = computed(() => {
  return {
    /** 边缘环位移强度（scale） */
    displacementScale: Math.max(0, edgeDisplacementScale.value),
    /** 边缘环色散强度 */
    aberrationIntensity: Math.max(0, edgeAberrationIntensity.value),
  }
})

/** 是否处于“显示贴图”的调试模式（会隐藏玻璃效果层，避免干扰观察） */
const isDebugMapMode = computed(() => debugNormalMap.value || debugEdgeRingMap.value)

/**
 * 根据阴影等级生成容器阴影（box-shadow）。
 * @param level 阴影等级（0=无阴影）
 */
function createGlassContainerShadow(level: number): string {
  const safeLevel = Number.isFinite(level) ? Math.max(0, level) : 1
  if (safeLevel <= 0)
    return 'none'

  const y = Math.max(0, 18 * safeLevel)
  const blur = Math.max(0, 60 * safeLevel)
  const alpha = clamp01(0.35 * safeLevel)
  return `0 ${y.toFixed(1).replace(/\.0$/, '')}px ${blur.toFixed(1).replace(/\.0$/, '')}px rgba(0, 0, 0, ${alpha.toFixed(3)})`
}

/** 玻璃容器样式：暴露阴影等级等外观参数。 */
const containerStyle = computed<CSSProperties>(() => {
  return {
    boxShadow: createGlassContainerShadow(shadowLevel.value),
  } as CSSProperties
})

const edgeWarpStyle = computed<CSSProperties>(() => {
  // 边缘环亮度补偿：抵消“厚度/阴影”带来的整体变暗，避免环内侧发灰
  const backdrop = `blur(${Math.max(0, edgeBlurPx.value)}px) saturate(${Math.max(
    0,
    edgeSaturation.value,
  )}%)`
  const maskImage = edgeMaskUrl.value ? `url(${edgeMaskUrl.value})` : undefined
  return {
    // 边缘环使用独立滤镜：在 ring 区域做更强的折射（更像 Apple 的“透镜边缘”）
    filter:
      normalMapUrl.value && !isDebugMapMode.value ? `url(#${edgeFilterId})` : undefined,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    // 使用动态 alpha 遮罩让 ring → center 平滑过渡，避免硬切边
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  } as CSSProperties
})

/** 调试：仅显示边缘环区域的位移贴图（用边缘环遮罩裁切） */
const edgeRingDebugStyle = computed<CSSProperties>(() => {
  const maskImage = edgeMaskUrl.value ? `url(${edgeMaskUrl.value})` : undefined
  return {
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  } as CSSProperties
})

const showEdgeLayer = computed(
  () => !isDebugMapMode.value && edgeRingWidthSafePx.value > 0 && Boolean(edgeMaskUrl.value),
)

const warpStyle = computed<CSSProperties>(() => {
  const backdrop = `blur(${blurPx.value}px) saturate(${saturation.value}%)`
  const bg = backgroundColor.value?.trim()
  return {
    // 贴图未生成前先降级为纯 backdrop-filter，避免 feImage 空 href 导致的闪烁/告警
    filter: normalMapUrl.value && !isDebugMapMode.value ? `url(#${filterId})` : undefined,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    background: bg || undefined,
  } as CSSProperties
})

watch([flatAreaScale, edgeHardness], () => {
  // 参数变化时强制重生成位移贴图（尺寸不变也需要更新）
  scheduleResizeUpdate(svgSize.value.width, svgSize.value.height, true)
})

watch([edgeRingWidthPx, edgeInnerFeatherPx], () => {
  // 边缘环参数变化时仅需更新遮罩（尺寸不变也需要更新）
  scheduleResizeUpdate(svgSize.value.width, svgSize.value.height)
})

onMounted(() => {
  generator = new DisplacementMapGenerator()
  maskGenerator = new AlphaMaskGenerator()

  if (!containerRef.value)
    return

  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value)
      return
    const rect = containerRef.value.getBoundingClientRect()
    scheduleResizeUpdate(rect.width, rect.height)
  })
  resizeObserver.observe(containerRef.value)

  const rect = containerRef.value.getBoundingClientRect()
  scheduleResizeUpdate(rect.width, rect.height)

  observeStyleChanges()
})

onUnmounted(() => {
  if (rafId !== null)
    cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  resizeObserver = null
  mutationObserver?.disconnect()
  mutationObserver = null

  generator?.destroy()
  generator = null

  maskGenerator?.destroy()
  maskGenerator = null
})
</script>

<template>
  <div ref="containerRef" class="glass-container" :style="containerStyle">
    <svg class="glass-svg" :width="svgSize.width" :height="svgSize.height" aria-hidden="true">
      <defs>
        <filter
          :id="filterId"
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            :href="normalMapUrl"
            :xlink:href="normalMapUrl"
            preserveAspectRatio="xMidYMid slice"
          />

          <!-- 使用贴图自身估算边缘 mask：强度越大，边缘色散越明显 -->
          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
            result="EDGE_INTENSITY"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" :tableValues="`0 ${aberrationIntensity * 0.05} 1`" />
          </feComponentTransfer>

          <!-- 中间保持干净（不做色散），边缘做色散 -->
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

          <!-- RGB 三通道分别位移 → 分离通道 → screen 合成 -->
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="displacementScale - aberrationIntensity * 0.05 * displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="displacementScale - aberrationIntensity * 0.1 * displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />

          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />

          <feGaussianBlur
            in="RGB_COMBINED"
            :stdDeviation="Math.max(0.1, 0.5 - aberrationIntensity * 0.1)"
            result="ABERRATED_BLURRED"
          />

          <feComposite
            in="ABERRATED_BLURRED"
            in2="EDGE_MASK"
            operator="in"
            result="EDGE_ABERRATION"
          />

          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite
            in="CENTER_ORIGINAL"
            in2="INVERTED_MASK"
            operator="in"
            result="CENTER_CLEAN"
          />

          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>

        <!-- 边缘环滤镜：与中心分离，用更强的折射/色散来模拟“厚透镜边缘” -->
        <filter
          :id="edgeFilterId"
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            :href="normalMapUrl"
            :xlink:href="normalMapUrl"
            preserveAspectRatio="xMidYMid slice"
          />

          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
            result="EDGE_INTENSITY"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA
              type="discrete"
              :tableValues="`0 ${edgeFilterParams.aberrationIntensity * 0.05} 1`"
            />
          </feComponentTransfer>

          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="edgeFilterParams.displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="edgeFilterParams.displacementScale - edgeFilterParams.aberrationIntensity * 0.05 * edgeFilterParams.displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="edgeFilterParams.displacementScale - edgeFilterParams.aberrationIntensity * 0.1 * edgeFilterParams.displacementScale"
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />

          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />

          <feGaussianBlur
            in="RGB_COMBINED"
            :stdDeviation="Math.max(0.1, 0.5 - edgeFilterParams.aberrationIntensity * 0.1)"
            result="ABERRATED_BLURRED"
          />

          <feComposite
            in="ABERRATED_BLURRED"
            in2="EDGE_MASK"
            operator="in"
            result="EDGE_ABERRATION"
          />

          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite
            in="CENTER_ORIGINAL"
            in2="INVERTED_MASK"
            operator="in"
            result="CENTER_CLEAN"
          />

          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    </svg>

    <span class="glass-warp" :style="warpStyle">
      <img
        v-if="debugNormalMap && normalMapUrl"
        class="glass-debug-map"
        :src="normalMapUrl"
        alt=""
        aria-hidden="true"
      >
      <img
        v-else-if="debugEdgeRingMap && normalMapUrl"
        class="glass-debug-map"
        :style="edgeRingDebugStyle"
        :src="normalMapUrl"
        alt=""
        aria-hidden="true"
      >
    </span>

    <!-- 边缘环层：更小 blur + 更强折射（只显示 ring 区域），用于逼近 Apple 的“透镜边缘”观感 -->
    <span v-if="showEdgeLayer" class="glass-edge" :style="edgeWarpStyle" />

    <div
      class="glass-content"
      :class="[contentClass, { 'glass-content--hidden': isDebugMapMode }]"
      :style="contentStyle"
      :aria-hidden="isDebugMapMode ? 'true' : undefined"
    >
      <slot />
    </div>

    <!-- 仅保留边缘高光边框：使用 SVG stroke 避免遮挡内容与滤镜失效 -->
    <template v-if="!isDebugMapMode">
      <svg
        class="glass-border-svg"
        :width="svgSize.width"
        :height="svgSize.height"
        aria-hidden="true"
      >
        <defs>
          <!-- 边缘高光（方向/颜色/强度可配置） -->
          <linearGradient
            :id="borderSoftGradientId"
            :x1="edgeHighlight.x1"
            :y1="edgeHighlight.y1"
            :x2="edgeHighlight.x2"
            :y2="edgeHighlight.y2"
          >
            <stop offset="0%" :stop-color="edgeHighlight.color" stop-opacity="0" />
            <stop offset="33%" :stop-color="edgeHighlight.color" stop-opacity="0.12" />
            <stop offset="66%" :stop-color="edgeHighlight.color" stop-opacity="0.4" />
            <stop offset="100%" :stop-color="edgeHighlight.color" stop-opacity="0" />
          </linearGradient>
          <linearGradient
            :id="borderStrongGradientId"
            :x1="edgeHighlight.x1"
            :y1="edgeHighlight.y1"
            :x2="edgeHighlight.x2"
            :y2="edgeHighlight.y2"
          >
            <stop offset="0%" :stop-color="edgeHighlight.color" stop-opacity="0" />
            <stop offset="33%" :stop-color="edgeHighlight.color" stop-opacity="0.32" />
            <stop offset="66%" :stop-color="edgeHighlight.color" stop-opacity="0.6" />
            <stop offset="100%" :stop-color="edgeHighlight.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <rect
          :x="borderStroke.x"
          :y="borderStroke.y"
          :width="borderStroke.width"
          :height="borderStroke.height"
          :rx="borderStroke.rx"
          :ry="borderStroke.ry"
          fill="none"
          :stroke="`url(#${borderSoftGradientId})`"
          :stroke-width="borderStroke.strokeWidth"
          :opacity="edgeHighlight.softOpacity"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <rect
          :x="borderStroke.x"
          :y="borderStroke.y"
          :width="borderStroke.width"
          :height="borderStroke.height"
          :rx="borderStroke.rx"
          :ry="borderStroke.ry"
          fill="none"
          :stroke="`url(#${borderStrongGradientId})`"
          :stroke-width="borderStroke.strokeWidth"
          :opacity="edgeHighlight.strongOpacity"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </template>
  </div>
</template>

<style>
:host {
  display: block;
}
</style>

<style scoped>
.glass-container {
  position: relative;
  overflow: hidden;
  border-radius: var(--liquid-glass-border-radius);
  border: var(--liquid-glass-border);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
}

.glass-svg {
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  position: absolute;
  inset: 0;
}

.glass-warp {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: inherit;
  overflow: hidden;
}

.glass-edge {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
  box-sizing: border-box;
}

.glass-debug-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.glass-content {
  z-index: 1;
  position: relative;
}

.glass-content--hidden {
  visibility: hidden;
  pointer-events: none;
}

.glass-border-svg {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  pointer-events: none;
}
</style>
