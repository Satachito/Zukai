//	Narration / caption / card copy for the Zukai YouTube intro video.
//
//	Edit the text here and re-run tools/make-intro-video.mjs — the captured
//	footage is reused, so a copy change only re-renders cards, audio and mux.
//
//	kind	'card'	fully rendered title card ( see CARDS in make-intro-video.mjs )
//			'shot'	captured app footage, held on its last frame if the
//					narration outlasts the motion
//	caption		burned-in lower-third label on 'shot' segments ( null = none )
//	narration	spoken text — spell things out the way a voice should read them
//	subtitle	optional written form for the .srt when it differs from spoken

//	Narration voices, one per language.
//
//	engine 'voicevox'	VOICEVOX ENGINE over HTTP — start VOICEVOX first;
//						override the endpoint with VOICEVOX_URL. `speaker` is a
//						style id: GET /speakers lists them ( 3 = ずんだもん
//						ノーマル, 2 = 四国めたん, 8 = 春日部つむぎ, 29 = No.7 ).
//						speed / pitch / intonation map to speedScale /
//						pitchScale / intonationScale.
//	engine 'voiceger'	local GPT-SoVITS ( voiceger ) install, driven through
//						tools/voiceger-tts.py. It has no HTTP API, so the models
//						are loaded in-process once per language. Paths are
//						relative to `root`; VOICEGER_ROOT / VOICEGER_PYTHON
//						override the two absolute ones.
//	engine 'say'		macOS built-in voices ( `say -v '?'` lists them ).
//
//	VOICEVOX handles Japanese; it spells Latin script out letter by letter
//	( "Zukai" → ズィイユウケエエエアイ ), so English goes through voiceger, which
//	speaks English in the same zundamon voice.
export const
VOICE	= {
	ja	: { engine: 'voicevox', speaker: 3, speed: 1.05, pitch: 0, intonation: 1.1 }
,	en	: {
		engine	: 'voiceger'
	,	root	: '/Users/s/Applications/voiceger_v2/GPT-SoVITS'
	,	python	: '/Users/s/Applications/voiceger_v2/.venv/bin/python'
	,	gpt		: 'GPT_weights_v2/zudamon_style_1-e15.ckpt'
	,	sovits	: 'SoVITS_weights_v2/zudamon_style_1_e8_s96.pth'
	,	refAudio	: 'reference_audios/01_ref_emoNormal026.wav'
	,	refText		: '私はいつもミネラルウォーターを持ち歩いています。'
	,	refLang		: 'Japanese'
	,	lang		: 'English'
	}
//	fallback if voiceger is not installed: , en: { engine: 'say', voice: 'Samantha', rate: 178 }
}

export const
LINK	= 'satachito.github.io/Zukai/'

export const
SEGMENTS	= [
	{
		id			: 'title'
	,	kind		: 'card'
	,	card		: 'title'
	,	lead		: .8
	,	tail		: .9
	,	narration	: {
			ja	: 'ズカイ。クラウド構成図を、AIと一緒に。ブラウザだけで動く、無料でオープンソースの作図エディタです。'
		,	en	: 'This is Zukai — build cloud diagrams with AI. A free, open source diagram editor that runs entirely in your browser.'
		}
	,	subtitle	: {
			ja	: 'Zukai。クラウド構成図を、AIと一緒に。ブラウザだけで動く、無料・オープンソースの作図エディタです。'
		,	en	: 'This is Zukai — build cloud diagrams with AI. A free, open source diagram editor that runs entirely in your browser.'
		}
	}
,	{
		id			: 'overview'
	,	kind		: 'shot'
	,	caption		: {
			ja	: '登録不要・インストール不要 — ブラウザで開くだけ'
		,	en	: 'No sign-up, no install — just open the page'
		}
	,	narration	: {
			ja	: '登録もインストールも要りません。ページを開けば、すぐに描き始められます。クラウド構成図、マインドマップ、シーケンス図。サンプルはワンクリックで読み込めます。'
		,	en	: 'No sign-up, no install. Open the page and start drawing. Cloud architecture, mind maps, sequence diagrams — every sample loads with a single click.'
		}
	}
,	{
		id			: 'icons'
	,	kind		: 'shot'
	,	caption		: {
			ja	: 'AWS · Azure · Google Cloud · Lucide のアイコンを内蔵'
		,	en	: 'AWS · Azure · Google Cloud · Lucide icons, built in'
		}
	,	narration	: {
			ja	: 'AWS、Azure、Google Cloud、そしてLucideのラインアイコンを内蔵。左のパネルから選ぶだけで、公式アイコンがそのままキャンバスに乗ります。'
		,	en	: 'AWS, Azure, Google Cloud and Lucide line icons are built in. Pick one from the left panel and the official icon drops straight onto the canvas.'
		}
	}
,	{
		id			: 'edit'
	,	kind		: 'shot'
	,	caption		: {
			ja	: 'ドラッグで作る、ドラッグでつなぐ'
		,	en	: 'Drag to create, drag to connect'
		}
	,	narration	: {
			ja	: 'ドラッグでノードを作り、ドラッグでつなぐ。矢印の形、アンカー、直交ルーティングまで細かく調整できます。キャンバスは最大4096かける4096。'
		,	en	: 'Drag to create a shape, then drag to connect it. Arrowheads, anchor points and orthogonal routing are all adjustable, on a canvas up to four thousand ninety six square.'
		}
	,	subtitle	: {
			ja	: 'ドラッグでノードを作り、ドラッグでつなぐ。矢印の形、アンカー、直交ルーティングまで細かく調整できます。キャンバスは最大 4096 × 4096。'
		,	en	: 'Drag to create a shape, then drag to connect it. Arrowheads, anchor points and orthogonal routing are all adjustable, on a canvas up to 4096 × 4096.'
		}
	}
,	{
		id			: 'json'
	,	kind		: 'card'
	,	card		: 'json'
	,	lead		: .6
	,	tail		: .8
	,	narration	: {
			ja	: '保存されるのは、ただのJSON。拡張子は、ドット ズー。人にもAIにも読めるので、Gitで差分を見ながらレビューできます。SVGやPDFへの書き出し、Figmaへの貼り付けにも対応。'
		,	en	: 'Your diagram is saved as plain JSON — a dot zu file. Readable by humans and by AI, and diffable in Git. Export to SVG or PDF, or copy the SVG straight into Figma.'
		}
	,	subtitle	: {
			ja	: '保存されるのは、ただのJSON。拡張子は .zu。人にもAIにも読めるので、Gitで差分を見ながらレビューできます。SVGやPDFへの書き出し、Figmaへの貼り付けにも対応。'
		,	en	: 'Your diagram is saved as plain JSON — a .zu file. Readable by humans and by AI, and diffable in Git. Export to SVG or PDF, or copy the SVG straight into Figma.'
		}
	}
,	{
		id			: 'ai'
	,	kind		: 'shot'
	,	caption		: {
			ja	: '自分のAPIキーで、アプリ内のClaude / OpenAIパネルから編集'
		,	en	: 'Edit from the built-in Claude / OpenAI panel with your own API key'
		}
	,	narration	: {
			ja	: 'そしてAI編集。アプリ内のClaude、またはOpenAIのパネルに自分のAPIキーを入れて、変更したいことを書くだけ。「VPNの帯を1.2倍高くして」。このとおりです。CursorからMCP経由で操作することもできます。'
		,	en	: 'And then, AI editing. Paste your own API key into the built-in Claude or OpenAI panel, and simply describe the change. Make the V P N band one point two times taller. Just like that. You can also drive it from Cursor over M C P.'
		}
	,	subtitle	: {
			ja	: 'そしてAI編集。アプリ内の Claude / OpenAI パネルに自分のAPIキーを入れて、変更したいことを書くだけ。「VPNの帯を1.2倍高くして」——このとおりです。Cursor から MCP 経由で操作することもできます。'
		,	en	: 'And then, AI editing. Paste your own API key into the built-in Claude or OpenAI panel, and simply describe the change: “Make the VPN band 1.2× taller.” Just like that. You can also drive it from Cursor over MCP.'
		}
	}
,	{
		id			: 'end'
	,	kind		: 'card'
	,	card		: 'end'
	,	lead		: .5
	,	tail		: 1.6
	,	narration	: {
			ja	: 'ズカイ。無料、オープンソース、登録不要。今すぐブラウザで試してみてください。'
		,	en	: 'Zukai. Free, open source, no sign-up. Try it in your browser today.'
		}
	,	subtitle	: {
			ja	: 'Zukai。無料・オープンソース・登録不要。今すぐブラウザで試してみてください。'
		,	en	: 'Zukai. Free, open source, no sign-up. Try it in your browser today.'
		}
	}
]
