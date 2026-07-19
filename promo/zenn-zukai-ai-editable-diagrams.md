---
title: "構成図をAIから編集したくて、JSONネイティブな図解ツールZukaiを作った"
emoji: "🗺️"
type: "tech"
topics: ["aws", "azure", "gcp", "ai", "opensource"]
published: false
---

クラウド構成図を更新するとき、図そのものよりも「どのツールで、どのファイルを、どう直すか」に時間がかかることがあります。

そこで作ったのが [Zukai](https://satachito.github.io/Zukai/) です。AWS、Azure、Google Cloudのアイコンを使えるブラウザ図解エディタで、図をJSONベースの`.zu`形式で保存します。登録やインストールなしで試せて、SVG・PDFへの出力にも対応しています。

この記事では、なぜ図をJSONにしたのか、AIからどう編集できるのかを紹介します。

![ZukaiのAI編集デモ](https://raw.githubusercontent.com/Satachito/Zukai/main/promo/api-free-demo/after.png)

## 図を「編集可能なデータ」として扱いたかった

構成図は設計書、README、提案資料、運用手順に何度も登場します。ところが、バイナリ形式の図は次のような場面で扱いにくくなりがちです。

- Gitの差分で何が変わったか確認しにくい
- 同じ図を別の人やAIに直してもらいにくい
- ちょっとした配置変更でもエディタを開く必要がある

Zukaiの`.zu`は、ノードとリンクをJSONで持ちます。たとえば最小の構成はこうです。

```json
{
	"model": {
		"nodes": [
			["API", { "type": "rect", "cX": 300, "cY": 200, "rH": 96, "rV": 48, "html": "API" }, { "fill": "#e8f0fe", "stroke": "#2563eb" }]
		],
		"links": []
	}
}
```

座標、形状、ラベル、色、リンクがテキストとして保存されるので、Gitで管理しやすく、AIにも渡しやすい形になります。

## ブラウザでまず描ける

ライブデモを開くと、すぐにサンプルを選べます。

- AWS / Azure / GCP の構成図
- マルチクラウド構成図
- シーケンス図
- マインドマップ

図形は矩形、楕円、ひし形のほか、SVGやPNGを配置できます。リンクには矢印、アンカー、直交ルーティングを設定できます。作成した図は`.zu`、SVG、PDFとして出力できます。

<https://satachito.github.io/Zukai/>

## AIに図の変更を頼める

Zukaiには、図をAIから操作するための経路が3つあります。

1. ブラウザ内のClaude / OpenAIパネル
2. ファイルを保存してブラウザにライブ反映する開発フロー
3. Cursor、Claude、Codexから使えるMCP

たとえば、MultiCloudサンプルを開いた状態で「VPNの帯を1.2倍高くして」と頼むと、AIはノードの位置とサイズを更新できます。

![AI編集の前後](https://raw.githubusercontent.com/Satachito/Zukai/main/promo/api-free-demo/before.png)

![AI編集後](https://raw.githubusercontent.com/Satachito/Zukai/main/promo/api-free-demo/after.png)

ブラウザ内のAIパネルでは、自分のAnthropicまたはOpenAI APIキーを使います。キーはブラウザの`localStorage`に保存され、リクエストはブラウザから各プロバイダへ直接送られます。共有端末では使わず、権限を絞ったキーを使うのがおすすめです。

## CursorなどからMCPで編集する

ローカルで編集する場合は、開発サーバーとMCPを起動します。

```bash
cd Web
npm install
npm run dev

cd ../tools
npm install
```

ブラウザで次を開きます。

```text
http://localhost:8281/?zu=Samples/MultiCloud.zu
```

そのうえで`zukai` MCPサーバーを有効にすると、チャットから現在の図を読み、変更し、必要ならファイルに保存できます。MCPによる変更はブラウザ上でUndo/Redoできます。

設定手順と利用できるツールは[USAGE.md](https://github.com/Satachito/Zukai/blob/main/USAGE.md)にまとめています。

## まず試してほしいこと

1. [ライブデモ](https://satachito.github.io/Zukai/)でMultiCloudサンプルを開く
2. ノードをドラッグして配置を変える
3. `.zu`またはSVGで出力する
4. APIキーを用意できる場合は、AIパネルから小さな変更を頼む

不具合報告や「こういう図を描きたい」という要望は、[GitHubのフィードバックフォーム](https://github.com/Satachito/Zukai/issues/new/choose)から送れます。APIキーなどの秘密情報は含めないでください。

リポジトリはこちらです。

<https://github.com/Satachito/Zukai>
