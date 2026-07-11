# Zukai 広報プラン

## 1. 広報の軸

### 一言で伝える

**AIと一緒に、クラウド構成図を描いて直せるブラウザ図解ツール。**

補足説明：

> Zukaiは、AWS・Azure・Google Cloudの構成図、マインドマップ、シーケンス図をブラウザで作れる無料の図解エディタです。図は扱いやすいJSON形式で保存でき、ClaudeやOpenAI、Cursorから自然言語で編集できます。

### 訴求の優先順位

1. **AIに言葉で頼んで図を編集できる**
2. **AWS・Azure・Google Cloudのアイコンをまとめて使える**
3. **登録・インストール不要で、ブラウザですぐ試せる**
4. **図がJSONなので、Git管理・差分確認・AI編集と相性がよい**
5. **SVG・PDF・`.zu`で保存できる**

「4096×4096 canvas」や詳細な描画機能は、最初の訴求ではなく機能紹介で伝える。

## 2. 主な対象ユーザー

### 最優先

- クラウド構成図を作るエンジニア、SRE、インフラ担当者
- README、設計資料、提案書に載せる図を素早く作りたい開発者
- CursorなどのAIコーディング環境を日常的に使う人

### 次点

- AWS・Azure・Google Cloudを横断して説明するプリセールス、講師
- シーケンス図やマインドマップも同じ道具で作りたい人
- 図をバイナリではなく、Gitで管理しやすい形式にしたいチーム

## 3. 表現案

### キャッチコピー候補

1. **その構成図、AIと一緒に描こう。**
2. **クラウド構成図を、言葉で直す。**
3. **Diagram as JSON. Edit with AI.**
4. **AWSもAzureもGCPも、ひとつのキャンバスに。**

当面は「その構成図、AIと一緒に描こう。」をメインにし、英語圏では「Diagram as JSON. Edit with AI.」を併記する。

### 30秒紹介

> Zukaiは、クラウド構成図に強いオープンソースのブラウザ図解ツールです。AWS、Azure、Google Cloudのアイコンを使い、登録なしですぐ描き始められます。図はJSONベースの`.zu`形式で保存でき、Claude、OpenAI、Cursorから「この帯を少し高くして」のように自然言語で編集できます。SVGやPDFへの出力にも対応しています。

## 4. そのまま使える投稿文

### X：初回告知

> クラウド構成図を、AIと一緒に描ける「Zukai」を公開しています。
>
> ・AWS / Azure / GCPアイコン対応  
> ・登録、インストール不要  
> ・Claude / OpenAI / Cursorから自然言語で編集  
> ・JSON形式で保存、Git管理しやすい  
> ・SVG / PDF出力  
>
> まずはサンプルを触ってみてください👇  
> https://satachito.github.io/Zukai/
>
> #個人開発 #OSS #AI #クラウド #AWS

### X：AI編集デモ向け

> 「VPNの帯を1.2倍高くして」  
> そんな指示で構成図を直せます。
>
> Zukaiは図をJSONで扱うので、Claude / OpenAI / Cursorと相性のよい図解エディタです。変更前→プロンプト→変更後を短い動画にしました。
>
> https://satachito.github.io/Zukai/
>
> #生成AI #Cursor #個人開発 #OSS

### GitHub / Product Hunt向け短文（英語）

> Zukai is an open-source, browser-based diagram editor for cloud architecture, mind maps, and sequence diagrams. It supports AWS, Azure, and Google Cloud icon palettes, stores diagrams as editable JSON, and lets you modify them with Claude, OpenAI, or Cursor. No signup or installation is required.

## 5. 最初に作る広報素材

優先順：

1. **15〜25秒のAI編集動画**
   - MultiCloudサンプルを開く
   - 「VPNの帯を1.2倍高くして」と指示
   - 図が変化する場面
   - 最後にURLと「無料・登録不要」
2. **OG画像**（1200×630）
   - 大きな構成図
   - 「その構成図、AIと一緒に描こう。」
   - AWS / Azure / GCP、JSON、Open Sourceの短い補足
3. **3枚のカルーセル**
   - 1枚目：何ができるか
   - 2枚目：AI編集のBefore / After
   - 3枚目：無料・登録不要・URL
4. **README冒頭のGIFまたは動画**

画面全体は情報量が多いため、スクリーンショットでは左右パネルを閉じるか、構成図とAI入力欄だけを切り出す。

## 6. 発信チャネル

### 優先

- X：短いデモ動画を中心に、機能を1投稿1テーマで紹介
- GitHub：READMEのファーストビューにGIF、特徴、Try nowを配置
- Zenn / Qiita：技術背景とJSON形式・Cursor連携を詳しく紹介
- Hacker News / Reddit：英語版。OSS、JSON-native、AI-editableを軸にする

### 後から検討

- Product Hunt
- AWS / Azure / Google Cloud関連コミュニティ
- 個人開発・AI開発系のイベントやDiscord

## 7. 技術記事の構成案

タイトル：

**「構成図をAIから編集したくて、JSONネイティブな図解ツールZukaiを作った」**

構成：

1. 既存の図解ツールで感じた課題
2. なぜ画像や独自バイナリではなくJSONなのか
3. `.zu`形式の最小例
4. Claude / OpenAI / Cursorから図を編集するデモ
5. AWS・Azure・Google Cloudの構成図を作る
6. SVG / PDF出力とGit管理
7. 今後ほしいフィードバック

## 8. 4週間の実行案

### 1週目：土台

- メインコピーを決定
- OG画像とAI編集デモを作成
- READMEの冒頭にGIFと「Try Zukai」を追加
- Xのプロフィールまたは固定投稿からデモへ誘導

### 2週目：初回発信

- Xで初回告知
- ZennまたはQiitaで開発記事を公開
- GitHub DiscussionsまたはIssuesにフィードバック導線を用意

### 3週目：用途別投稿

- AWS構成図
- マルチクラウド構成図
- シーケンス図
- Cursorによる自然言語編集

各投稿で一機能だけを見せ、同じ総合紹介を繰り返さない。

### 4週目：英語圏

- READMEとデモ字幕の英語表現を調整
- Hacker News、Reddit、Product Hunt向け素材を準備
- 反応のよかった用途をトップメッセージに反映

## 9. 測定する数字

- デモへの訪問数
- サンプルボタンの利用数
- `.zu`保存、SVG・PDF出力の利用数
- GitHub Star数
- READMEからデモへのクリック数
- AIパネル利用開始数
- 投稿ごとのリンククリック率

Google Analyticsでは、最低限 `sample_open`、`export_zu`、`export_svg`、`export_pdf`、`ai_send` をイベント化する。APIキーやプロンプト本文は計測に送らない。

## 10. 広報前に解消したい点

- 初期画面は操作項目が多いため、初回ユーザー向けに「サンプルを開く」の導線を強くする
- AIモデル名が実在・提供中の名称と一致しているか確認する
- AI利用時にユーザー自身のAPIキーが必要なことを紹介ページで明示する
- クラウド各社の公式アイコンは利用条件があるため、「Zukai自体がISC」と「アイコンの条件」を分けて説明する
- 日本語で最短の操作説明を用意する

## 11. 次の判断

最初の広報キャンペーンは、次の組み合わせを推奨する。

**対象：** AIを使うクラウドエンジニア  
**訴求：** 自然言語でクラウド構成図を編集  
**素材：** MultiCloudのBefore / After動画  
**誘導先：** ライブデモ  
**行動：** サンプルを開いてAI編集または手動編集を試す

