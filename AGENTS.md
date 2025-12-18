# Repository Guidelines

## 项目结构与模块组织

- `src/`：库源码与导出入口（`src/index.ts`），Vue 组件（如 `src/glass.vue`）与 Props/类型（`src/glass-props.ts`）。
- `dist/`：构建产物（由 `tsdown` 生成，已在 `.gitignore` 忽略）；不要手动编辑，按需重新构建。
- 根目录配置：`tsdown.config.ts`、`eslint.config.mjs`、`tsconfig.*.json`（以及项目引用文件 `tscofnig.json`）。

## 构建、测试与开发命令

- `pnpm install`：安装依赖（建议使用 `pnpm@10`，以 `package.json#packageManager` 为准）。
- `pnpm build`：打包到 `dist/`（ESM + CJS），并生成类型声明。
- `pnpm tsc`：运行 `vue-tsc --noEmit` 做类型检查（提交前必跑）。
- `pnpm lint` / `pnpm lint:fix`：ESLint 检查与自动修复（仓库使用 `@antfu/eslint-config`，并在 VS Code 中默认用 ESLint 修复代替 Prettier）。
- `pnpm release`：维护者用的发布流程（版本号更新、打 tag、发布到 npm）。

推荐的本地检查顺序：

```bash
pnpm install
pnpm lint
pnpm tsc
pnpm build
```

## 编码风格与命名约定

- 2 空格缩进；优先使用单引号；保持 ESM（`"type": "module"`）。
- 组件文件使用 kebab-case（例如 `glass.vue`），对外导出使用 PascalCase（例如 `Glass`）。
- 新增/调整对外 API（Props、导出函数、类）必须补充注释：函数/类/方法注释；interface/type 成员逐项注释。
- 性能敏感逻辑（如贴图生成/滤镜参数）优先用纯函数 + `computed`/`watch`，避免在渲染热路径里做高频分配。

## 测试指南

- 当前仓库未内置测试框架；提交前至少通过 `pnpm tsc` 与 `pnpm lint`。
- 如引入测试，请在 PR 中说明框架选择，并将测试集中在 `tests/` 或 `src/**/__tests__/`。

## 常见改动指引

- 新增组件：添加 `src/<component>.vue` 与 `src/<component>-props.ts`，并在 `src/index.ts` 中统一导出（同时导出 props/type）。
- 新增对外导出后，确认 `package.json#exports` 仍满足发布需求（默认入口为 `.`）。
- 需要调整打包行为（format、dts、clean、sourcemap）时，修改 `tsdown.config.ts` 并用 `pnpm build` 验证产物。

## Commit 与 Pull Request 规范

- 提交信息遵循 Conventional Commits（例如 `feat: ...`、`fix: ...`、`chore: ...`），一行概述 + 必要时补充正文。
- 示例：`feat(glass): add edge ring mask`、`fix: clamp displacement values`、`docs: add usage snippet`。
- PR 需包含：变更动机/影响范围、关联 issue、必要的截图/录屏（视觉效果变更）、以及你运行过的命令（如 `pnpm build`）。
- 如有破坏性变更，请在提交或 PR 中标注 `BREAKING CHANGE:`，并说明迁移方式与版本影响。
- 若变更涉及导出或类型，请同步更新 `src/index.ts` 与对应的 props/type 声明，确保 `pnpm build` 生成的 `.d.ts` 完整。

## 代理与联网命令（重要）

- 执行联网命令前先设置代理（例如 `pnpm install` / `pnpm publish` / `git push`）：
  `export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890`
