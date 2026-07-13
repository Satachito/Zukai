export const
RoleE 		= ( $, _ ) => $.querySelector( `[data-role=${_}]` )

export const
AC			= ( $, _ ) => $.appendChild( _ )

export const
E			= _ => document.createElement( _ )

export const
AE			= ( $, _ ) => AC( $, E( _ ) )

export const
Input		= _ => {
	const	$ = E( 'input' )
	_ && ( $.value = _ )
	return $
}

export const
Select		= ( ..._ ) => {
	const $ = E( 'select' )
	for ( const option of _ ) AE( $, 'option' ).innerHTML = option
	return $
}

export const
Labeled		= ( parent, label, _ ) => {
	const
	$ = AE( parent, 'div' )

	AE( $, 'span' ).textContent	= label

	return AC( $, _ )
}

export const
LabeledInput	= ( parent, label, _ = ''		) => Labeled( parent, label, Input( _ ) )

export const
LabeledSelect	= ( parent, label, ..._			) => Labeled( parent, label, Select( ..._ ) )

export const
LabeledTextArea	= ( parent, label ) => {
	const $ = AE( parent, 'div' )
	AE( $, 'div' ).textContent	= label
	return AE( $, 'textarea' )
}

export const
EscapeXML		= _ => String( _ )
.	replace( /&/g, '&amp;' )
.	replace( /</g, '&lt;' )
.	replace( />/g, '&gt;' )
.	replace( /"/g, '&quot;' )

//	Embedded icon SVGs ( type:'SVG' nodes ) carry document-global <style> rules
//	and generic ids ( .cls-1, #mask… ). Inlined side by side into one scene or
//	export SVG those collide across icons — the last <style> wins and url(#…)
//	resolves into another icon's defs — so rescope ids and rules per embed.
let
embedSeq		= 0

const
EscapeRegExp	= _ => _.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' )

const
ScopeSVG		= ( root, scope ) => {
	const
	ids = new Map()
	for ( const el of root.querySelectorAll( '[id]' ) ) {
		const	id = el.getAttribute( 'id' )
		ids.set( id, `${ scope }-${ id }` )
		el.setAttribute( 'id', ids.get( id ) )
	}
	const
	fixURLs = _ => {
		for ( const [ o, n ] of ids ) _ = _.replaceAll( `url(#${ o })`, `url(#${ n })` )
		return _
	}
	for ( const el of root.querySelectorAll( '*' ) ) {
		for ( const at of el.attributes ) {
			if	( at.value.includes( 'url(#' ) ) {
				at.value = fixURLs( at.value )
			} else if (
				( at.name === 'href' || at.name === 'xlink:href' )
			&&	at.value.startsWith( '#' )
			&&	ids.has( at.value.slice( 1 ) )
			) {
				at.value = `#${ ids.get( at.value.slice( 1 ) ) }`
			}
		}
	}
	root.setAttribute( 'class', `${ root.getAttribute( 'class' ) ?? '' } ${ scope }`.trim() )
	for ( const style of root.querySelectorAll( 'style' ) ) {
		let	$ = style.textContent
		//	'#id' followed by a delimiter covers both url(#id) and #id selectors
		for ( const [ o, n ] of ids ) {
			$ = $.replace( new RegExp( `#${ EscapeRegExp( o ) }(?![\\w-])`, 'g' ), `#${ n }` )
		}
		//	confine every plain rule to this embed's subtree
		style.textContent = $.replace(
			/(^|\})([^{}@]+)\{/g
		,	( m, brace, sels ) =>
				brace + sels.split( ',' ).map( _ => `.${ scope } ${ _.trim() }` ).join( ',' ) + '{'
		)
	}
}

export const
ParseEmbeddedSVG	= ( b64, w, h ) => {
	const
	svgText = new TextDecoder().decode(
		Uint8Array.from( atob( b64 ), ch => ch.charCodeAt( 0 ) )
	)
	,	root = new DOMParser().parseFromString( svgText, 'image/svg+xml' ).documentElement
	if	( root.querySelector( 'parsererror' ) || root.tagName.toLowerCase() !== 'svg' ) {
		throw new Error( 'Invalid embedded SVG' )
	}
	if	( !root.getAttribute( 'viewBox' ) ) {
		const
		ow = Number.parseFloat( root.getAttribute( 'width' ) ) || w
		,	oh = Number.parseFloat( root.getAttribute( 'height' ) ) || h
		root.setAttribute( 'viewBox', `0 0 ${ ow } ${ oh }` )
	}
	ScopeSVG( root, `zu-embed-${ ++embedSeq }` )
	return root
}

//	Canvas 2D does not reliably accept CSS light-dark() / color-mix() / var().
//	Resolve light-dark(light, dark) against prefers-color-scheme for overlay draws
//	( selection drag, create/link gestures ). Nested rgb() commas are OK.
export const
ResolveColor	= color => {
	if	( typeof color !== 'string' ) return color
	const
	s = color.trim()
	if	( !/^light-dark\s*\(/i.test( s ) || !s.endsWith( ')' ) ) return color
	const
	inner = s.replace( /^light-dark\s*\(/i, '' ).slice( 0, -1 )
	let
	depth = 0
	,	split = -1
	for ( let i = 0; i < inner.length; i++ ) {
		const
		c = inner[ i ]
		if	( c === '(' ) depth++
		else if ( c === ')' ) depth--
		else if ( c === ',' && depth === 0 ) {
			split = i
			break
		}
	}
	if	( split < 0 ) return color
	const
	light = inner.slice( 0, split ).trim()
	,	dark = inner.slice( split + 1 ).trim()
	return matchMedia( '(prefers-color-scheme: dark)' ).matches ? dark : light
}

