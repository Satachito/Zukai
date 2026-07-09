//	ノードラベル ( shape.html / shape.style ) 用の許可リストサニタイズ。
//	信頼できない .zu でも script / イベントハンドラ / 危険 CSS を落とす。

export const
ALLOWED_TAGS = new Set( [
	'b', 'strong', 'i', 'em', 'u', 's'
,	'br', 'span', 'small', 'sub', 'sup', 'code'
] )

//	中身ごと捨てる（unwrap すると script 本文がテキストとして残る）
const
DROP_WITH_CONTENT = new Set( [
	'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base'
,	'form', 'input', 'textarea', 'button', 'select', 'option'
,	'svg', 'math', 'template', 'noscript', 'video', 'audio', 'source'
,	'img', 'picture', 'canvas', 'a'
] )

const
VOID_TAGS = new Set( [ 'br' ] )

const
ALLOWED_CSS = new Set( [
	'color', 'background-color'
,	'font-size', 'font-weight', 'font-style', 'font-family'
,	'text-align', 'text-decoration', 'line-height', 'letter-spacing', 'white-space'
,	'display', 'place-items', 'place-content', 'align-items', 'justify-content', 'justify-items', 'gap'
,	'opacity', 'padding', 'margin', 'width', 'height', 'box-sizing'
] )

const
BAD_CSS_VALUE	= /url\s*\(|expression\s*\(|javascript:|@import|behavior|-moz-binding|binding\s*:/i

const
escapeText		= _ => String( _ )
.	replace( /&/g, '&amp;' )
.	replace( /</g, '&lt;' )
.	replace( />/g, '&gt;' )

const
escapeAttr		= _ => escapeText( _ ).replace( /"/g, '&quot;' )

export const
sanitizeStyle	= css => {
	if	( !css ) return ''
	return	String( css ).split( ';' ).flatMap(
		decl => {
			const
			i = decl.indexOf( ':' )
			if	( i < 0 ) return []
			const
			prop	= decl.slice( 0, i ).trim().toLowerCase()
			,	value	= decl.slice( i + 1 ).trim().replace( /\n/g, '' )
			if	( !prop || !value ) return []
			if	( !ALLOWED_CSS.has( prop ) ) return []
			if	( BAD_CSS_VALUE.test( value ) ) return []
			//	属性・スタイル文脈からの脱出を防ぐ
			if	( /[<>{}]/.test( value ) ) return []
			return [ `${ prop }:${ value }` ]
		}
	).join( ';' )
}

//	許可タグだけ残した DOM を foreignObject 向け XHTML 断片に直列化する。
const
serializeNode	= node => {
	if	( node.nodeType === 3 ) return escapeText( node.textContent )
	if	( node.nodeType !== 1 ) return ''

	const
	tag = node.tagName.toLowerCase()
	if	( VOID_TAGS.has( tag ) ) return `<${ tag }/>`

	const
	style = node.getAttribute?.( 'style' )
	,	open = style
		?	`<${ tag } style="${ escapeAttr( style ) }">`
		:	`<${ tag }>`
	,	inner = [ ...node.childNodes ].map( serializeNode ).join( '' )
	return	`${ open }${ inner }</${ tag }>`
}

const
appendSanitized	= ( srcParent, dstParent ) => {
	const
	doc = dstParent.ownerDocument
	for ( const node of [ ...srcParent.childNodes ] ) {
		if	( node.nodeType === 3 ) {	//	TEXT_NODE
			dstParent.appendChild( doc.createTextNode( node.textContent ) )
			continue
		}
		if	( node.nodeType !== 1 ) continue	//	ELEMENT_NODE only

		const
		tag = node.tagName.toLowerCase()

		if	( DROP_WITH_CONTENT.has( tag ) ) continue

		if	( !ALLOWED_TAGS.has( tag ) ) {
			//	未知タグは外して中身だけ残す（装飾用の余分なラッパ対策）
			appendSanitized( node, dstParent )
			continue
		}

		const
		el = doc.createElement( tag )
		if	( node.hasAttribute( 'style' ) ) {
			const
			safe = sanitizeStyle( node.getAttribute( 'style' ) )
			safe && el.setAttribute( 'style', safe )
		}
		//	style 以外の属性 ( onclick, href, src, class, id, … ) はすべて捨てる
		if	( !VOID_TAGS.has( tag ) ) appendSanitized( node, el )
		dstParent.appendChild( el )
	}
}

export const
sanitizeLabelHtml	= html => {
	//	フル HTML ドキュメント + innerHTML 代入。断片を text/html で直接
	//	parseFromString すると環境によって body に載らないことがある。
	const
	doc = new DOMParser().parseFromString(
		'<!DOCTYPE html><html><body><div id="__zu_label__"></div></body></html>'
	,	'text/html'
	)
	,	src = doc.getElementById( '__zu_label__' )
	,	dst = doc.createElement( 'div' )
	src.innerHTML = String( html ?? '' )
	appendSanitized( src, dst )
	return	[ ...dst.childNodes ].map( serializeNode ).join( '' )
}
