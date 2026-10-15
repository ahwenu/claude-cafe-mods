# ☕ cafe-files（喫茶ファイル）

Claude Code の右ペインに、プロジェクトのファイルを喫茶店のメニューのように並べる Mod です。

- 黒板メニュー風のヘッダーとカフェ店員（バリスタ）
- 画像はサムネで表示。設定（⚙）から音声・動画・書類なども表示できる
- 看板風のパンくずでフォルダを行き来。対象ファイルがあるフォルダを自動で開く
- サムネを押すと詳細画面。◀ ▶ で前後、伝票（ORDER）にファイル情報
- 「☕ プロンプトに入れる」でファイルの絶対パスを入力欄へ挿入
- ペイン幅に合わせて 1 行の枚数が変わる（カードの大きさは 小 / 中 / 大）
- 開くと喫茶店のジャズが小さめの音量でループ再生（⚙ の「♪ BGM」でオン / オフ、閉じると停止）

## インストール

Claude Code のプロンプトで:

```
/plugin install cafe-files --marketplace ahwenu/claude-cafe-mods
```

マーケットプレイスの追加を聞かれたら `y`、続けてスコープを選びます。インストール後、`/files` でペインが開きます。

## 使い方

| 操作 | 内容 |
| --- | --- |
| `/files` | ペインを開く |
| ⚙ | 表示する種類・隠しファイル・並び順・カードの大きさ |
| サムネ / ファイル名 | 詳細画面を開く |
| `P` | プロンプトにパスを入れる |
| `C` | パスをコピー |
| `H` / `L` | 前 / 次のファイル |
| `X` | 一覧へ戻る |
| `U` | 上のフォルダへ |

## 動作環境

- function hooks（Mod）に対応した Claude Code（デスクトップアプリ同梱版など）
- macOS（サムネの縮小に `sips`、BGM の再生に `afplay` を使います。無い環境ではアイコン表示・無音になります）

## 開発

```
claude plugin validate cafe-files
claude plugin test cafe-files
```

バリスタのスプライトは `cafe-files/scripts/make-assets.py` で `~/.codex/pets` から生成しています。

## クレジット

- BGM: "jazz improvisation looped" by Alex McCulloch (Pro Sensory) — [OpenGameArt](https://opengameart.org/content/jazz-improvisation-looped), CC0

## ライセンス

MIT © 2026 AHWENU'S COFFEE
