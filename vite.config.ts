// defineConfig は vitest/config から取る (`test` キーの型がこれで通る)
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/career-v2/',
  plugins: [react(), tailwindcss()],
  test: {
    // ロードマップのクリア判定はコンポーネントの中にあるため、描画しないと検証できない。
    // v2.11 の「チェックしても達成数が動かない」バグが本番まで行ったのは、
    // ここに DOM 環境が無く**判定ロジックがテストの外**だったから (HANDOFF §7-17)。
    environment: 'jsdom',
  },
})
