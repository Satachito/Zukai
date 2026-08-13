# Zukai — YouTube intro video

Two narrated 1080p intros built from real app footage, one per language.

| File | Length | Notes |
|------|--------|-------|
| `zukai-intro-ja.mp4` | ~1:44 | Japanese narration — VOICEVOX ずんだもん |
| `zukai-intro-en.mp4` | ~1:32 | English narration — voiceger (GPT-SoVITS) ずんだもん |
| `zukai-intro-ja.ja.srt` / `zukai-intro-ja.en.srt` | — | subtitles for the JA video, both languages |
| `zukai-intro-en.ja.srt` / `zukai-intro-en.en.srt` | — | subtitles for the EN video, both languages |

1920×1080, 30 fps, H.264 + AAC 192 kbps, `+faststart` — upload as is.
Upload the two `.srt` files that match the video you are uploading (YouTube →
Subtitles → Upload file), so each video is captioned in both languages.

## Rebuild

Needs the dev server for the footage, VOICEVOX running for the Japanese
narration, and the voiceger install for the English one (`VOICEVOX_URL`,
`VOICEGER_ROOT` and `VOICEGER_PYTHON` override the defaults).

```bash
cd Web && npm run dev
```

```bash
node tools/make-intro-video.mjs
```

`--lang ja` / `--lang en` builds one language; `--skip-capture` reuses the
cached footage in `$TMPDIR/zukai-intro` and only re-renders cards, narration and
the mux — that is the fast path after a copy change, and it does not need the
dev server.

Copy lives in [`tools/intro-script.mjs`](../../tools/intro-script.mjs):
`narration` is what the voice says, `subtitle` is the written form used in the
`.srt` when it differs (`.zu` vs “dot zu”), `caption` is the burned-in
lower third.

## Segments

| # | Segment | Content |
|---|---------|---------|
| 1 | Title card | wordmark, tagline, Free / Open source / No sign-up, URL |
| 2 | Overview | MultiCloud sample loads, panels collapse, slow pan, MindMap → Sequence |
| 3 | Icons | AWS palette expands, two icons placed and arranged |
| 4 | Editing | two shapes created via drag, linked, then moved so the link re-routes |
| 5 | `.zu` card | JSON snippet + Git / AI / SVG-PDF-Figma bullets |
| 6 | AI | prompt typed into the Claude panel, result highlighted, pull-back |
| 7 | End card | tagline + URL |

## Worth knowing

- **Narration is synthesized, and the credit line is required.** Japanese goes
  through VOICEVOX (ずんだもん, speaker id 3), English through the local
  [voiceger](https://github.com/Satachito/voiceger_v2) / GPT-SoVITS install
  driven by [`tools/voiceger-tts.py`](../../tools/voiceger-tts.py). Keep
  「VOICEVOX:ずんだもん」 in the description — the VOICEVOX terms ask for it.
  Both engines are configured in
  [`tools/intro-script.mjs`](../../tools/intro-script.mjs) `VOICE`; swapping a
  language back to macOS `say` is a one-line change. To use a human voice
  instead, drop your own WAV over `$TMPDIR/zukai-intro/audio/<lang>-<id>.wav`
  and run with `--skip-capture`.
- **voiceger output is not deterministic** (it samples at temperature 1), so
  the English length shifts by a few seconds between runs — re-check the
  chapter timestamps after every rebuild.
- **Segment 6 is a reproduction, not a live API call.** The prompt is typed for
  real, then the diagram is swapped to `Samples/MultiCloudPromoAfter.zu` — the
  result that prompt produces — so the build needs no API key. The narration
  never claims a live request. Re-record that segment against a real key if you
  want a literal capture.

## Upload copy

### Japanese

**Title**

```
Zukai — クラウド構成図を、AIと一緒に。ブラウザだけで動く無料の作図エディタ
```

**Description**

```
Zukai は、クラウド構成図・マインドマップ・シーケンス図をブラウザだけで描ける、
無料・オープンソースの作図エディタです。登録もインストールも不要。

▸ 今すぐ試す: https://satachito.github.io/Zukai/
▸ ソース: https://github.com/Satachito/Zukai

できること
・AWS / Azure / Google Cloud / Lucide の公式アイコンを内蔵
・ドラッグでノードを作成、ドラッグでリンク（矢印・アンカー・直交ルーティング対応）
・最大 4096 × 4096 のキャンバス
・保存形式は素の JSON（.zu）— Git で差分レビューでき、手でも AI でも編集可能
・SVG / PDF 書き出し、SVG をコピーして Figma へ貼り付け
・アプリ内の Claude / OpenAI パネルで自然言語編集（APIキーは各自のものを使用）
・Cursor から MCP 経由でも操作可能

00:00 Zukai とは
00:10 ブラウザで開くだけ
00:24 クラウドアイコン
00:40 ドラッグで作図
00:54 .zu は素の JSON
01:14 AI で編集
01:35 まとめ

音声: VOICEVOX:ずんだもん / voiceger (GPT-SoVITS)

#Zukai #構成図 #クラウド #AWS #Azure #GoogleCloud #開発ツール #オープンソース
```

**Tags**

```
Zukai, 構成図, クラウド構成図, ダイアグラム, 作図ツール, AWS, Azure, Google Cloud,
マインドマップ, シーケンス図, オープンソース, 無料ツール, AI, MCP, Cursor
```

### English

**Title**

```
Zukai — Build cloud diagrams with AI. Free, open source, runs in your browser
```

**Description**

```
Zukai is a free, open source diagram editor for cloud architecture, mind maps
and sequence diagrams. No sign-up, no install — it runs entirely in the browser.

▸ Try it: https://satachito.github.io/Zukai/
▸ Source: https://github.com/Satachito/Zukai

What it does
· AWS / Azure / Google Cloud / Lucide icon palettes, built in
· Drag to create shapes, drag to connect (arrowheads, anchors, orthogonal routing)
· Canvas up to 4096 × 4096
· Saves as plain JSON (.zu) — diffable in Git, editable by hand or by AI
· Export SVG / PDF, or copy the SVG straight into Figma
· Built-in Claude / OpenAI panel for natural-language edits (bring your own key)
· Drive it from Cursor over MCP

00:00 What Zukai is
00:10 Just open the page
00:23 Cloud icon palettes
00:34 Drag to create, drag to connect
00:47 .zu is plain JSON
01:03 Editing with AI
01:22 Wrap-up

Voices: VOICEVOX:ずんだもん / voiceger (GPT-SoVITS)

#Zukai #diagrams #cloudarchitecture #AWS #Azure #GoogleCloud #devtools #opensource
```

**Tags**

```
Zukai, cloud diagram, architecture diagram, diagram editor, AWS diagram,
Azure diagram, GCP diagram, mind map, sequence diagram, open source, free tool,
AI diagramming, MCP, Cursor
```

Chapter timestamps are rounded from the built videos — re-check them after any
copy change or rebuild, since segment lengths follow the narration.
