// 喫茶店風テーマ。surface 側は palette(ctx) で現在の配色を得る。
export type Colors = {
  cream: string // 背景（紙）
  milk: string // カード面
  espresso: string // 主テキスト
  caramel: string // アクセント（強調）
  latte: string // 副面・ホバー
  line: string // 罫線
  muted: string // 補助テキスト
  accent: string // ボタン等の主色
  danger: string
}

export const LIGHT: Colors = {
  cream: '#F6EEDF',
  milk: '#FFF9EE',
  espresso: '#3B2A20',
  caramel: '#B9793C',
  latte: '#E4D2B6',
  line: '#A8896A',
  muted: '#7A6552',
  accent: '#B9793C',
  danger: '#B3402F',
}

export const DARK: Colors = {
  cream: '#2A1F18',
  milk: '#352920',
  espresso: '#F3E8D4',
  caramel: '#D9984F',
  latte: '#4A392C',
  line: '#5A4636',
  muted: '#BBA68C',
  accent: '#D9984F',
  danger: '#E2705E',
}

export const T = {
  colors: LIGHT,
  dark: DARK,
  radius: { sm: 4, md: 8, lg: 14 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  font: {
    family: "ui-rounded, 'Hiragino Maru Gothic ProN', 'Hiragino Sans', system-ui, sans-serif",
    mono: "ui-monospace, 'SF Mono', Menlo, monospace",
    size: { xs: 11, sm: 12, md: 14, lg: 16, xl: 20 },
  },
}

/** e に載っているテーマ情報からダークかを推定。無ければ false（light 固定）。 */
export function isDark(ctx: { e: any }): boolean {
  const e = ctx?.e ?? {}
  const c = [e.colorScheme, e.theme, e.themeName, e.props?.colorScheme, e.props?.theme, e.props?.themeName]
  for (const v of c) {
    if (typeof v === 'string') return /dark/i.test(v)
  }
  if (typeof e.isDark === 'boolean') return e.isDark
  if (typeof e.props?.isDark === 'boolean') return e.props.isDark
  return false
}

export function palette(ctx: { e: any }): Colors {
  return isDark(ctx) ? DARK : LIGHT
}

/** terminal 用: 近似 ANSI 名 */
export const ANSI: Record<keyof Colors, string> = {
  cream: 'white',
  milk: 'whiteBright',
  espresso: 'black',
  caramel: 'yellow',
  latte: 'gray',
  line: 'gray',
  muted: 'gray',
  accent: 'yellow',
  danger: 'red',
}

export function ansi(name: keyof Colors): string {
  return ANSI[name]
}
