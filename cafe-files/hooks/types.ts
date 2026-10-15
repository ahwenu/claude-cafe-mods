// 全担当共通の契約。ここは変更しない（変更が必要なら統合担当に伝える）。
export type Kind = 'image' | 'audio' | 'video' | 'doc' | 'other'

export type Entry = {
  name: string
  path: string // 絶対パス
  isDir: boolean
  kind: Kind // フォルダは 'other'
  size: number
  mtimeMs: number
}

export type Crumb = { label: string; path: string; isHome?: boolean; isRoot?: boolean }

/** 各 UI 関数に渡す描画コンテキスト */
export type Ctx = {
  $: any // engine `$`
  e: any // ui.render の入力（e.surface / e.viewport / e.props.bodyColumns）
  els: any // $.ui.resolve(e) の結果 { Box, Text, Button, Svg?, Image?, ... }
  surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'
  /** ペイン本体の幅（セル or CSS px。terminal はセル） */
  width: number
}

export type Actions = {
  openDir: (path: string) => void
  openFile: (path: string) => void
  closeViewer: () => void
  step: (delta: 1 | -1) => void // 詳細で次/前
  toggleSettings: () => void
  setKinds: (kinds: Kind[]) => void
  insertPath: (path: string) => void // プロンプト欄へ絶対パスを挿入
  copyPath: (path: string) => void
}
