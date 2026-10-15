import type { ClientModule } from 'claude-code'

/**
 * 何も描かない透明な「押せる領域」（Client の surface module）。
 * サムネやギアの上に重ね、左クリックで props.msg をフックへ post する。
 * Markdown のリンクと違って下線などが一切出ない。
 */
type HitProps = { msg: { [k: string]: string | number | boolean } }

const Hit: ClientModule<HitProps> = (props, surface) => {
  // 毎回登録し直す（後の登録が前を置き換える）ので、常に最新の props を送る
  surface.onPointer(ev => {
    if (ev.type === 'down' && (ev.button ?? 'left') === 'left') surface.post(props.msg)
  })
  return surface.elements.Box({ width: '100%', height: '100%' } as any)
}

export default Hit
