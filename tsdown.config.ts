import type { UserConfig } from 'tsdown'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { cwd } from 'node:process'
import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'

/**
 * 将构建产物里的独立 CSS 文件“内联进 JS”并删除 CSS 文件。
 *
 * 目标：
 * - `src/index.ts`（组件库入口）：在浏览器环境自动把样式注入 `document.head`
 * - `src/web-component.ts`（Web Component 入口）：把样式写入 `Glass.def.styles`，
 *   让 Vue Custom Element 在 ShadowRoot 内注入样式（无需额外引入 CSS）
 *
 * 说明：
 * - 该逻辑在 `build:done` 阶段执行（产物已落盘），因此不会影响打包过程；
 * - 追加的 JS 代码只插入在 `//# sourceMappingURL=` 之前，避免影响原有 sourcemap 的行号映射。
 */
async function inlineCssToJs(ctx: {
  options?: { cwd?: string, entry?: unknown }
  chunks?: Array<{ type?: string, fileName?: string, outDir?: string, source?: unknown, isEntry?: boolean }>
}) {
  const chunks = ctx.chunks ?? []
  const buildCwd = ctx.options?.cwd ?? cwd()

  // 以 `index.css` / `web-component.css` 的 basename 作为 key，对应到 `index.js|index.cjs` 等入口产物。
  const cssByBaseName = new Map<string, string>()
  for (const asset of chunks) {
    if (asset?.type !== 'asset' || !asset.fileName?.endsWith('.css'))
      continue

    const baseName = path.parse(asset.fileName).name
    const source = asset.source
    const cssText = typeof source === 'string'
      ? source
      : source instanceof Uint8Array
        ? Buffer.from(source).toString('utf8')
        : ''

    const cleanedCssText = stripCssSourceMapComment(cssText).trim()
    if (!cleanedCssText)
      continue

    cssByBaseName.set(baseName, cleanedCssText)
  }

  if (!cssByBaseName.size)
    return

  const entryChunks = chunks
    .filter(chunk => chunk?.type === 'chunk' && chunk.isEntry && chunk.fileName)
    .filter(chunk => chunk.fileName!.endsWith('.js') || chunk.fileName!.endsWith('.cjs'))

  if (!entryChunks.length)
    return

  // 同一个 entry 可能同时输出 ESM 与 CJS；逐个产物注入对应的 CSS。
  for (const entryChunk of entryChunks) {
    const outDir = entryChunk.outDir ?? 'dist'
    const entryFilePath = path.resolve(buildCwd, outDir, entryChunk.fileName!)
    const baseName = path.parse(entryChunk.fileName!).name
    const cssText = cssByBaseName.get(baseName)
    if (!cssText)
      continue

    const injection = baseName.includes('web-component')
      ? createWebComponentStyleInjection(cssText)
      : createHeadStyleInjection(cssText)

    await patchEntryFile(entryFilePath, injection)
  }

  // 删除本次构建输出的 CSS（以及对应的 sourcemap）。
  await Promise.all(chunks
    .filter(chunk => chunk?.type === 'asset' && (chunk.fileName?.endsWith('.css') || chunk.fileName?.endsWith('.css.map')))
    .map(async (asset) => {
      const fileName = asset.fileName
      const assetOutDir = asset.outDir ?? 'dist'
      if (!fileName)
        return
      await safeUnlink(path.resolve(buildCwd, assetOutDir, fileName))
    }))
}

/**
 * 移除 CSS 末尾的 `/*# sourceMappingURL=... *\/` 注释，避免注入到运行时代码里。
 */
function stripCssSourceMapComment(css: string): string {
  return css.replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/s, '')
}

/**
 * 将注入片段插入到 `//# sourceMappingURL=` 之前（若不存在则追加到末尾）。
 * 同时通过 marker 避免重复注入。
 */
async function patchEntryFile(entryFilePath: string, injection: string) {
  const marker = '/* liquid-glass:css-inlined */'
  const original = await fs.readFile(entryFilePath, 'utf8')
  if (original.includes(marker))
    return

  const snippet = `${marker}\n${injection}\n`
  const sourcemapIndex = original.lastIndexOf('//# sourceMappingURL=')
  const next = sourcemapIndex === -1
    ? `${original}\n${snippet}`
    : `${original.slice(0, sourcemapIndex)}${snippet}${original.slice(sourcemapIndex)}`

  await fs.writeFile(entryFilePath, next, 'utf8')
}

/** 删除文件（不存在时忽略）。 */
async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath)
  }
  catch {}
}

/**
 * 生成“组件库入口”的样式注入代码：
 * - 在浏览器环境注入 `<style>` 到 `document.head`
 * - 使用固定 `id` 去重，避免重复插入
 */
function createHeadStyleInjection(css: string): string {
  const cssLiteral = JSON.stringify(css)
  return [
    `const __liquidGlassCss = ${cssLiteral};`,
    `function __ensureLiquidGlassStyle() {`,
    `  if (typeof document === 'undefined') return;`,
    `  const styleId = 'yafh-liquid-glass';`,
    `  if (document.getElementById(styleId)) return;`,
    `  const style = document.createElement('style');`,
    `  style.id = styleId;`,
    `  style.textContent = __liquidGlassCss;`,
    `  (document.head || document.documentElement).appendChild(style);`,
    `}`,
    `__ensureLiquidGlassStyle();`,
  ].join('\n')
}

/**
 * 生成“Web Component 入口”的样式注入代码：
 * - 写入 `Glass.def.styles`，让 Vue CE 在 ShadowRoot 内注入样式
 */
function createWebComponentStyleInjection(css: string): string {
  const cssLiteral = JSON.stringify(css)
  return [
    `const __liquidGlassCss = ${cssLiteral};`,
    `if (typeof Glass !== 'undefined' && Glass && Glass.def) {`,
    `  Glass.def.styles = [__liquidGlassCss];`,
    `}`,
    `if (typeof GlassDebugPanel !== 'undefined' && GlassDebugPanel && GlassDebugPanel.def) {`,
    `  GlassDebugPanel.def.styles = [__liquidGlassCss];`,
    `}`,
  ].join('\n')
}

const base = {
  outDir: 'dist',
  dts: {
    vue: true,
  },
  format: ['esm', 'cjs'],
  clean: true,
  sourcemap: true,
  platform: 'browser',
  exports: true,
  tsconfig: './tsconfig.app.json',
  plugins: [Vue({ isProduction: true })],
} satisfies UserConfig

export default defineConfig([{
  ...base,
  entry: './src/index.ts',
  hooks: {
    'build:done': async function (ctx) {
      await inlineCssToJs(ctx)
    },
  },
}, {
  ...base,
  entry: './src/web-component.ts',
  noExternal: ['vue'],
  hooks: {
    'build:done': async function (ctx) {
      await inlineCssToJs(ctx)
    },
  },
}])
