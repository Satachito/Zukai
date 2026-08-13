//	Prompts and copy for the "Claude builds a .zu over MCP" video.
//
//	PROMPTS are sent verbatim to `claude -p` by tools/mcp-session.mjs — what the
//	video shows in the chat panel is exactly what was asked and answered.
//	SEGMENTS / VOICE mirror tools/intro-script.mjs.

export { VOICE, LINK } from './intro-script.mjs'

export const
PROMPTS	= {
	ja	: [
		'zukai MCP のツールだけを使って、ブラウザで開いている図に AWS の 3 層構成を描いてください。ALB → API ( ECS Fargate ) → RDS の 3 ノードを縦に並べ、上から下へリンクでつなぎます。ノードは rect ( rH 120 / rV 48 )、cX は 640 で揃え、cY は 220 / 460 / 700。ラベルは area の html に入れ、paint には lineWidth 2 と、暗い背景でもはっきり見える明るい色の stroke を必ず指定してください。最後に zu_validate で確認を。',
		'ALB と API を囲む「Public Subnet」と、RDS を囲む「Private Subnet」の枠を rect で追加して、背面に置いてください。枠には薄い色の stroke を付けて、ラベルも入れて。'
	]
,	en	: [
		'Using only the zukai MCP tools, draw a three-tier AWS stack into the diagram open in the browser. Three rect nodes stacked vertically — ALB → API ( ECS Fargate ) → RDS — linked top to bottom. rH 120, rV 48 each, cX 640 for all three, cY 220 / 460 / 700, labels in the area html. Give every node a paint with lineWidth 2 and a bright stroke colour that reads on a dark background. Finish with zu_validate.',
		'Now add two grouping rects behind them: "Public Subnet" around ALB and API, "Private Subnet" around RDS. Give each a light stroke and a label, and send them to the back.'
	]
}

//	Narration. `subtitle` overrides the written form when the spoken text differs.
export const
SEGMENTS	= [
	{
		id			: 'title'
	,	kind		: 'card'
	,	card		: 'title'
	,	lead		: .8
	,	tail		: .9
	,	narration	: {
			ja	: 'Zukai は MCP サーバーを持っています。つまり、図を描くのは人ではなく、Claude でもかまいません。'
		,	en	: 'Zukai ships an MCP server. Which means the one drawing the diagram does not have to be you — it can be Claude.'
		}
	}
,	{
		id			: 'setup'
	,	kind		: 'card'
	,	card		: 'setup'
	,	lead		: .6
	,	tail		: .8
	,	narration	: {
			ja	: 'ローカルで開発サーバーを立ち上げて、zukai の MCP サーバーを Claude につなぐだけ。ブラウザで開いている図が、そのまま Claude の作業台になります。'
		,	en	: 'Start the local dev server, point Claude at the zukai MCP server, and the diagram open in your browser becomes the workbench.'
		}
	,	subtitle	: {
			ja	: 'ローカルで dev サーバーを立ち上げて、zukai の MCP サーバーを Claude につなぐだけ。ブラウザで開いている図が、そのまま Claude の作業台になります。'
		,	en	: 'Start the local dev server, point Claude at the zukai MCP server, and the diagram open in your browser becomes the workbench.'
		}
	}
,	{
		id			: 'build'
	,	kind		: 'shot'
	,	caption		: {
			ja	: '実際のセッション — Claude が zu_apply で図を組み立てる'
		,	en	: 'A real session — Claude builds the diagram with zu_apply'
		}
	,	narration	: {
			ja	: '「AWS の 3 層構成を描いて」と頼むだけ。Claude はモデルを読み、ノードとリンクを組み立て、zu_apply で送り込みます。キャンバスはその場で更新されます。'
		,	en	: 'Just ask for a three-tier AWS stack. Claude reads the model, works out the nodes and the links, and sends them through zu_apply. The canvas updates as it goes.'
		}
	}
,	{
		id			: 'refine'
	,	kind		: 'shot'
	,	caption		: {
			ja	: '追加の一言で、図が育っていく'
		,	en	: 'One more sentence, and the diagram grows'
		}
	,	narration	: {
			ja	: '続けて「サブネットの枠で囲んで」。Claude は既存のノードの座標を読み取って、背面に枠を足します。やり取りを重ねるほど図が育っていきます。'
		,	en	: 'Then: wrap them in subnet boxes. Claude reads the coordinates it already placed, and adds the frames behind them. The diagram grows with the conversation.'
		}
	}
,	{
		id			: 'result'
	,	kind		: 'card'
	,	card		: 'result'
	,	lead		: .6
	,	tail		: .8
	,	narration	: {
			ja	: '出来上がるのは、ただのJSON。人が続きを描いてもいいし、Gitに入れて差分を見てもいい。AIと人が同じファイルを触れます。'
		,	en	: 'What comes out is plain JSON. Keep drawing by hand, or commit it and review the diff. The AI and you edit the very same file.'
		}
	,	subtitle	: {
			ja	: '出来上がるのは、ただの JSON。人が続きを描いてもいいし、Git に入れて差分を見てもいい。AI と人が同じファイルを触れます。'
		,	en	: 'What comes out is plain JSON. Keep drawing by hand, or commit it and review the diff. The AI and you edit the very same file.'
		}
	}
,	{
		id			: 'end'
	,	kind		: 'card'
	,	card		: 'end'
	,	lead		: .5
	,	tail		: 1.6
	,	narration	: {
			ja	: 'ズカイ。無料、オープンソース、登録不要。MCPの設定はUSAGEに書いてあります。'
		,	en	: 'Zukai. Free, open source, no sign-up. The MCP setup is in USAGE.'
		}
	,	subtitle	: {
			ja	: 'Zukai。無料・オープンソース・登録不要。MCP の設定は USAGE.md に。'
		,	en	: 'Zukai. Free, open source, no sign-up. The MCP setup is in USAGE.md.'
		}
	}
]
