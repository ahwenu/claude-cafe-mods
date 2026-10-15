import type { Ctx } from '../types'

// 喫茶店の配色。背景も文字も明示するので、ホストが明暗どちらのテーマでも読める
export const BG = '#2A1D15' // ペイン背景（エスプレッソ）
export const PANEL = '#3A2A20' // カード・看板の面（ローストブラウン）
export const PANEL2 = '#46331F' // 一段明るい面
export const INK = '#F6ECDD' // 本文（ミルクフォーム）
export const SUB = '#D2BC9C' // 補助文字（カフェラテ）
export const ACC = '#EDB273' // 強調（キャラメル）
export const RULE = '#76543A' // 罫線（木枠）
export const RULE_HI = '#EDB273' // ホバー時の罫線

/** Button はホストのテーマで描かれる（色指定不可）ので、そのまま使う */
export function mkButton(ctx: Ctx): (p: any) => any {
  return ctx.els.Button
}
