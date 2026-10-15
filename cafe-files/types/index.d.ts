/** cafe-files の状態契約（PluginState に直接列挙する必要がある）。 */
export type CafeFilesSort = 'name' | 'recent'

declare module 'claude-code' {
  interface PluginState {
    'cafe-files': {
      /** 表示中のフォルダ（絶対パス）。空文字 = 作業ディレクトリ */
      cwd: string
      /** 詳細表示中のファイルの絶対パス。空文字 = 一覧 */
      openPath: string
      /** 設定シートを開いているか */
      isSettingsOpen: boolean
      /** 有効な種別（Kind[]）。既定 ['image'] */
      kinds: string[]
      showHidden: boolean
      /** 'name' | 'recent' */
      sort: string
      /** 隅のキャラ名（'barista' | 'none'） */
      pet: string
      /** カードの大きさ 's' | 'm' | 'l' */
      cardSize: string
      /** 開いたときにジャズを流すか */
      bgm: boolean
    }
  }
}
