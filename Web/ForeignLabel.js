//	S.html / S.style の HTML + CSS を SVG foreignObject として描画する。
//	ラベルは SanitizeLabel.js の許可リストで無害化してから埋め込む。

import { EscapeXML } from './DomUtils.js'
import { XYWH } from './GeoZU.js'
import { sanitizeLabelHtml, sanitizeStyle } from './SanitizeLabel.js'

const
labelWrapperStyle	= S => {
	const
	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	//	div が foreignObject 全体を埋めることで、ノード側の flex/grid 指定
	//	( place-items:center など ) でラベルを中央寄せできる。
	//	height:100% がないと div が内容サイズに縮み、文字が上に寄る。
	const
	extra = sanitizeStyle( S.style || '' )
	return	`width:100%;height:100%;box-sizing:border-box;color-scheme:light dark;color:${ color };${ extra }`
}

export const
foreignObjectSvg	= S => {
	const
	[ w, h ] = [ S.rH * 2, S.rV * 2 ]
	,	style = labelWrapperStyle( S )
	,	body = sanitizeLabelHtml( S.html )
	return	`<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${ EscapeXML( style ) }">${ body }</div></foreignObject></svg>`
}

export const
DrawForeignLabel	= async ( drawSVG, S ) => {
	if	( !S.html ) return
	await drawSVG( [ foreignObjectSvg( S ) ], S )
}

export const
drawForeignLabelSvg	= ( parts, X, Y, S ) => {
	if	( !S.html ) return
	const
	[ x, y, w, h ] = XYWH( S )
	,	style = labelWrapperStyle( S )
	,	body = sanitizeLabelHtml( S.html )
	parts.push(
		`<foreignObject x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }">`
	,	`<div xmlns="http://www.w3.org/1999/xhtml" style="${ EscapeXML( style ) }">${ body }</div>`
	,	`</foreignObject>`
	)
}
