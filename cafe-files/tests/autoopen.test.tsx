import { expect, mock, test } from 'claude-code/testing'

// フォルダタイルからの移動は「対象ファイルがあるフォルダ」へ自動解決される。
const TREE: Record<string, any[]> = {
  '/Users/me/proj': [{ name: 'assets', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }],
  '/Users/me/proj/assets': [{ name: 'img', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }],
  '/Users/me/proj/assets/img': [{ name: 'cup.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false }],
}

// cwd の状態はテスト内で持ち越されるため、surface ごとに別テストにする
for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: openDir from a folder tile resolves to the child folder with images`, async ($, on) => {
    mock.env(on, { HOME: '/Users/me' })
    on('session.cwd', async () => ({ value: '/Users/me/proj' }))
    on('fs.list', async (_$: any, e: any) => ({ value: TREE[e.path] ?? [] }))
    const toasts: string[] = []
    on('ui.toast', async (_$: any, e: any) => {
      toasts.push(e.text)
      return { value: undefined } as any
    })
    const ui = await $.ui.mount({
      plugin: 'cafe-files',
      surface,
      component: 'Pane',
      requestId: 'cafe-files',
      props: { bodyColumns: 48 } as any,
    })
    // 直下はフォルダ assets だけ → タイルを押すと assets/img（配下の最寄り）へ
    await ui.press({ key: 'open-0' } as any)
    expect(toasts).toEqual(['☕ img を開きました（画像があるフォルダ）'])
    expect(await ui.find({ text: /cup\.png/ })).toBeDefined()
    await ui.unmount()
  })
}
