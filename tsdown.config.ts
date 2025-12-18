import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'

export default defineConfig({
  outDir: 'dist',
  dts: {
    vue: true,
  },
  format: ['esm', 'cjs'],
  clean: true,
  sourcemap: true,
  platform: 'browser',
  exports: true,
  entry: './src/index.ts',
  plugins: [Vue({ isProduction: true })],
})
