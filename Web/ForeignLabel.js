//	S.html / S.style の HTML + CSS を SVG foreignObject として描画する。
//	Live scene: 生の HTML（Sanitize なし）。Export: SanitizeLabel で無害化。

import { EscapeXML } from './DomUtils.js'
import { XYWH } from './GeoZU.js'
import { sanitizeLabelHtml, sanitizeStyle } from './SanitizeLabel.js'

const
SVG_NS		= 'http://www.w3.org/2000/svg'
,	XHTML_NS	= 'http://www.w3.org/1999/xhtml'

const
labelWrapperStyle	= ( S, { sanitize } ) => {
	const
	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	//	div が foreignObject 全体を埋めることで、ノード側の flex/grid 指定
	//	( place-items:center など ) でラベルを中央寄せできる。
	//	height:100% がないと div が内容サイズに縮み、文字が上に寄る。
	const
	extra = sanitize ? sanitizeStyle( S.style || '' ) : ( S.style || '' )
	return	`width:100%;height:100%;box-sizing:border-box;color-scheme:light dark;color:${ color };${ extra }`
}

//	Live SVG DOM: raw html / style (Load 時に危険内容は確認ダイアログ)。
export const
appendLiveLabel	= ( parent, S ) => {
	if	( !S.html ) return
	const
	[ x, y, w, h ] = XYWH( S )
	,	fo = document.createElementNS( SVG_NS, 'foreignObject' )
	fo.setAttribute( 'x', x )
	fo.setAttribute( 'y', y )
	fo.setAttribute( 'width', w )
	fo.setAttribute( 'height', h )
	const
	div = document.createElementNS( XHTML_NS, 'div' )
	div.setAttribute( 'style', labelWrapperStyle( S, { sanitize: false } ) )
	div.innerHTML = String( S.html )
	fo.appendChild( div )
	parent.appendChild( fo )
}

//	Export / copy / print: sanitized markup only.
export const
drawForeignLabelSvg	= ( parts, X, Y, S ) => {
	if	( !S.html ) return
	const
	[ x, y, w, h ] = XYWH( S )
	,	style = labelWrapperStyle( S, { sanitize: true } )
	,	body = sanitizeLabelHtml( S.html )
	parts.push(
		`<foreignObject x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }">`
	,	`<div xmlns="http://www.w3.org/1999/xhtml" style="${ EscapeXML( style ) }">${ body }</div>`
	,	`</foreignObject>`
	)
}
