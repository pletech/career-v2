// defineConfig は vitest/config から取る (`test` キーの型がこれで通る)
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** `career` / `/career` / `/career/` のどれで渡されても `/career/` にする */
function normalizeBase(value: string | undefined): string {
  const name = (value ?? 'career-v2').split(/[/\\]/).filter(Boolean).pop() ?? '';
  return name === '' ? '/' : `/${name}/`;
}

export default defineConfig({
  /**
   * 配信パス。**ビルド時に焼き込まれる**ので、置き場所が変わると必ず直す必要がある。
   *
   * - GitHub Pages … `career-v2` (リポジトリ名)
   * - 移設先 (Wadax) … `career` を予定
   *
   * `VITE_BASE=career npm run build` のように**先頭のスラッシュなし**で渡す。
   *
   * ⚠️ **スラッシュ付きで渡さない。** Git Bash (MSYS) は `/career/` を Windows パスと
   * みなして `C:/Program Files/Git/career/` に書き換えてしまう。実際に踏んだ —
   * ビルドは成功し、壊れた `src="/Program Files/Git/career/assets/..."` が出るだけなので
   * 気づきにくい。ここで正規化して、どの形で渡されても `/career/` にする。
   */
  base: normalizeBase(process.env.VITE_BASE),
  plugins: [react(), tailwindcss()],
  test: {
    // ロードマップのクリア判定はコンポーネントの中にあるため、描画しないと検証できない。
    // v2.11 の「チェックしても達成数が動かない」バグが本番まで行ったのは、
    // ここに DOM 環境が無く**判定ロジックがテストの外**だったから (HANDOFF §7-17)。
    environment: 'jsdom',
  },
})
