import type { ClientModule } from 'claude-code'

/**
 * 何も描かない透明な「押せる領域」（Client の surface module）。
 * カードやギアの上に重ね、左クリックで props.msg をフックへ post する。
 * Markdown のリンクと違って下線などが一切出ない。
 */
type HitProps = { msg: { [k: string]: string | number | boolean } }

// 押した（down）で送り、それに続く離した（up）は捨てる。down が届かず up だけ来る面でも動く
let downAt = 0

const Hit: ClientModule<HitProps> = (props, surface) => {
  // 毎回登録し直す（後の登録が前を置き換える）ので、常に最新の props を送る
  surface.onPointer(ev => {
    if (ev.type !== 'down' && ev.type !== 'up') return
    if (ev.button && ev.button !== 'left') return
    const now = Date.now()
    if (ev.type === 'down') {
      downAt = now
      surface.post(props.msg)
      return
    }
    if (now - downAt < 1500) {
      downAt = 0
      return
    }
    surface.post(props.msg)
  })
  // 領域いっぱいの空の Box（何も描かない）
  const cols = Math.max(1, surface.columns || 1)
  const rows = Math.max(1, surface.rows || 1)
  return surface.elements.Box({ width: cols, height: rows } as any)
}

export default Hit
