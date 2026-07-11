//	Live diagram scene: build an SVG DOM from app.model (shapes, links, labels).
//	Labels go in as raw foreignObject HTML (no SanitizeLabel) — Export still sanitizes.

import { XYWH, ArrowDs } from './GeoZU.js'
import { ParseEmbeddedSVG } from './DomUtils.js'
import { appendLiveLabel, activateLiveLabelScripts } from './ForeignLabel.js'
import { layoutScrollableLabels } from './LabelScroll.js'

const
SVG_NS = 'http://www.w3.org/2000/svg'

const
E	= ( tag, attrs = {} ) => {
	const
	$ = document.createElementNS( SVG_NS, tag )
	for ( const [ k, v ] of Object.entries( attrs ) ) {
		if	( v != null && v !== '' ) $.setAttribute( k, v )
	}
	return $
}

const
paintAttrs	= P => {
	const
	a = { fill: P.fill ? P.fill : 'none' }
	P.stroke			&& ( a.stroke = P.stroke )
	P.lineWidth			&& ( a[ 'stroke-width' ] = P.lineWidth )
	P.lineCap			&& ( a[ 'stroke-linecap' ] = P.lineCap )
	P.lineJoin			&& ( a[ 'stroke-linejoin' ] = P.lineJoin )
	P.lineDash			&& ( a[ 'stroke-dasharray' ] = P.lineDash.join( ' ' ) )
	P.lineDashOffset	&& ( a[ 'stroke-dashoffset' ] = P.lineDashOffset )
	return a
}

const
appendShape	= ( parent, S, P ) => {
	const
	a = paintAttrs( P )
	switch ( S.type ) {
	case 'rect': {
		const
		[ x, y, w, h ] = XYWH( S )
		,	r = S.radii ?? 0
		parent.appendChild(
			E( 'rect', {
				x, y, width: w, height: h
			,	...( r ? { rx: r, ry: r } : {} )
			,	...a
			} )
		)
		break
	}
	case 'ellipse':
		parent.appendChild(
			E( 'ellipse', { cx: S.cX, cy: S.cY, rx: S.rH, ry: S.rV, ...a } )
		)
		break
	case 'rhombus':
		parent.appendChild(
			E( 'polygon', {
				points: [
					[ S.cX, S.cY - S.rV ]
				,	[ S.cX + S.rH, S.cY ]
				,	[ S.cX, S.cY + S.rV ]
				,	[ S.cX - S.rH, S.cY ]
				].map( ( [ x, y ] ) => `${ x },${ y }` ).join( ' ' )
			,	...a
			} )
		)
		break
	case 'SVG': {
		//	Keep the full <svg> ( root stroke/fill/viewBox inherit correctly ).
		//	Only children → <g> drops presentation attrs on the root.
		const
		[ x, y, w, h ] = XYWH( S )
		,	nested = document.importNode( ParseEmbeddedSVG( S.SVG, w, h ), true )
		nested.setAttribute( 'x', x )
		nested.setAttribute( 'y', y )
		nested.setAttribute( 'width', w )
		nested.setAttribute( 'height', h )
		parent.appendChild( nested )
		break
	}
	case 'PNG': {
		const
		[ x, y, w, h ] = XYWH( S )
		parent.appendChild(
			E( 'image', {
				href	: `data:image/png;base64,${ S.PNG }`
			,	x, y, width: w, height: h
			} )
		)
		break
	}
	default:
		throw new Error( `Unknown shape type: ${ S.type }` )
	}
}

const
appendArrowHead	= ( parent, d, stroked, fill, stroke, width ) => {
	if	( !d ) return
	parent.appendChild(
		E( 'path', {
			d
		,	...( stroked
			?	{ fill: 'none', stroke, 'stroke-width': width }
			:	{ fill, stroke: 'none' }
			)
		,	'stroke-linecap'	: 'round'
		,	'stroke-linejoin'	: 'round'
		} )
	)
}

const
appendLink	= ( parent, link ) => {
	const
	P = link[ 2 ]
	,	stroke = P.stroke ?? 'dodgerblue'
	,	a = {
			fill				: 'none'
		,	stroke
		,	'stroke-linecap'	: P.lineCap || 'butt'
		,	'stroke-linejoin'	: P.lineJoin || 'round'
		}
	P.lineWidth			&& ( a[ 'stroke-width' ] = P.lineWidth )
	P.lineDash			&& ( a[ 'stroke-dasharray' ] = P.lineDash.join( ' ' ) )
	P.lineDashOffset	&& ( a[ 'stroke-dashoffset' ] = P.lineDashOffset )

	const
	{ shaftD, headDF, strokeF, headDT, strokeT } = ArrowDs( link )
	parent.appendChild( E( 'path', { d: shaftD, ...a } ) )

	const
	headFill = P.fill ?? stroke
	,	headWidth = P.lineWidth || 1
	appendArrowHead( parent, headDF, strokeF, headFill, stroke, headWidth )
	appendArrowHead( parent, headDT, strokeT, headFill, stroke, headWidth )
}

export const
mountSceneSvg	= host => {
	const
	svg = E( 'svg', { class: 'zu-scene', xmlns: SVG_NS } )
	svg.style.position		= 'absolute'
	svg.style.pointerEvents	= 'none'
	host.appendChild( svg )
	return svg
}

export const
setSceneSize	= ( svg, w, h ) => {
	svg.setAttribute( 'width', w )
	svg.setAttribute( 'height', h )
	svg.setAttribute( 'viewBox', `0 0 ${ w } ${ h }` )
}

export const
paintScene	= ( svg, model ) => {
	while ( svg.firstChild ) svg.removeChild( svg.firstChild )

	for ( const [ ID, S, P ] of model.nodes ) {
		try {
			const
			g = E( 'g', { 'data-id': ID } )
			appendShape( g, S, P )
			appendLiveLabel( g, S )
			svg.appendChild( g )
		} catch ( er ) {
			console.error( 'paintScene failed:', ID, er )
		}
	}

	const
	find	= ID => model.nodes.find( _ => _[ 0 ] === ID )
	,	links	= E( 'g', { class: 'zu-links' } )
	for ( const [ [ F, T ], A, P ] of model.links ) {
		const
		nF = find( F )
		,	nT = find( T )
		nF && nT && appendLink( links, [ [ nF, nT ], A, P ] )
	}
	svg.appendChild( links )
	activateLiveLabelScripts( svg )
	layoutScrollableLabels( svg )
}
