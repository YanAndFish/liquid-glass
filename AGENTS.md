# 仓库协作指南

## 沟通与文档

- 默认使用简体中文沟通与写文档（含本仓库的 `AGENTS.md` 与子 Agent 描述文件）。
- 编写/修改代码时需要补充合适注释：函数级注释、类/方法注释、interface/type/VO 注释（成员逐项注释）。
- 执行需要联网的命令前，先确保已设置代理环境变量（见「代理与联网命令」）。

## 项目结构与模块组织

- `src/`：源码与对外导出。
  - `src/index.ts`：库入口（导出 `Glass`、`GlassDebugPanel` 及相关类型）。
  - `src/web-component.ts`：Web Component 入口（对应 `package.json#exports["./web-component"]`）。
  - `src/glass.vue` / `src/glass-debug-panel.vue`：Vue 组件；Props/类型通常直接在 `.vue` 中定义并导出。
  - `src/glass-debug.ts`：调试面板的状态类型与默认值工厂函数。
- `dist/`：构建产物（由 `tsdown` 生成，已在 `.gitignore` 忽略）；不要手动编辑，按需重新构建。
- 根目录配置：
  - `tsdown.config.ts`：打包配置（包含构建后将 CSS 内联进 JS 并清理独立 CSS 文件的逻辑）。
  - `eslint.config.mjs`：ESLint 配置（基于 `@antfu/eslint-config`）。
  - `tsconfig.json`：Project References（引用 `tsconfig.app.json` 与 `tsconfig.node.json`）。

## 构建、测试与开发命令

- `pnpm install`：安装依赖（建议使用 `package.json#packageManager` 指定的版本）。
- `pnpm build`：打包到 `dist/`（ESM + CJS）并生成类型声明。
- `pnpm type-check`：运行 `vue-tsc -b --noEmit` 做类型检查（提交前必跑）。
- `pnpm lint` / `pnpm lint:fix`：ESLint 检查与自动修复。
- `pnpm release`：维护者用的发布流程（版本号更新、打 tag、发布到 npm）。

推荐的本地检查顺序：

```bash
pnpm install
pnpm lint
pnpm type-check
pnpm build
```

## 编码风格与命名约定

- 2 空格缩进；优先使用单引号；保持 ESM（`"type": "module"`）。
- 组件文件使用 kebab-case（例如 `glass.vue`），对外导出使用 PascalCase（例如 `Glass`）。
- 新增/调整对外 API（Props、导出函数、类等）必须补充注释：函数/类/方法注释；interface/type 成员逐项注释（VO 亦然）。
- 性能敏感逻辑（如贴图生成/滤镜参数）优先用纯函数 + `computed`/`watch`，避免在渲染热路径里做高频分配。

## 测试指南

- 当前仓库未内置测试框架；提交前至少通过 `pnpm type-check` 与 `pnpm lint`。
- 如引入测试，请在 PR 中说明框架选择，并将测试集中在 `tests/` 或 `src/**/__tests__/`。

## 常见改动指引

- 新增组件：添加 `src/<component>.vue`（必要时配套 `src/<component>.ts` 放置类型/工具），并在 `src/index.ts` 中统一导出（同时导出类型）。
- 新增对外导出后，确认 `package.json#exports` 仍满足发布需求（默认入口为 `.`）。
- 需要调整打包行为（format、dts、clean、sourcemap、CSS 内联策略）时，修改 `tsdown.config.ts` 并用 `pnpm build` 验证产物。

## Commit 与 Pull Request 规范

- 提交信息遵循 Conventional Commits（例如 `feat: ...`、`fix: ...`、`chore: ...`），一行概述 + 必要时补充正文。
- 示例：`feat(glass): add edge ring mask`、`fix: clamp displacement values`、`docs: add usage snippet`。
- PR 需包含：变更动机/影响范围、关联 issue、必要的截图/录屏（视觉效果变更）、以及你运行过的命令（如 `pnpm build`）。
- 如有破坏性变更，请在提交或 PR 中标注 `BREAKING CHANGE:`，并说明迁移方式与版本影响。
- 若变更涉及导出或类型，请同步更新 `src/index.ts` / `src/web-component.ts` 与对应的类型声明，确保 `pnpm build` 生成的 `.d.ts` 完整。

## 代理与联网命令（重要）

- 执行联网命令前先设置代理（例如 `pnpm install` / `pnpm publish` / `git push` / `npm install` / `pip install` / `cargo add` / `flutter pub add`）：
  `export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890`
