import {
	E
}	from './DomUtils.js'

import {
	DeltaXY
,	DivXY
,	AddXY
,	MulXY
,	Union
} from './Geo2D.js'

export const
C2D				= E('canvas').getContext( '2d' )

export const
GRAB			= 8

export const
XYWH			= ( { cX, cY, rH, rV } ) => [ cX - rH, cY - rV, rH + rH, rV + rV ]

export const
T				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY - rV : cY + rV

export const
B				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY + rV : cY - rV

export const
L				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX - rH : cX + rH

export const
R				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX + rH : cX - rH

export const
TLBR			= ( { cX, cY, rH, rV } ) => 0 < rH
?	0 < rV
	?	[ cY - rV, cX - rH, cY + rV, cX + rH ]
	:	[ cY + rV, cX - rH, cY - rV, cX + rH ]
:	0 < rV
	?	[ cY - rV, cX + rH, cY + rV, cX - rH ]
	:	[ cY + rV, cX + rH, cY - rV, cX - rH ]

export const
BBox			= _ => Union( _.map( _ => TLBR( _[ 1 ] ) ) )

export const
RectPath2D		= S => {
	const	$ = new Path2D
	$.roundRect( ...XYWH( S ), S.radii ?? 0 )
	return	$
}

export const
EllipsePath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.ellipse( cX, cY, rH, rV, 0, 0, 2 * Math.PI )
	return	$
}

export const
RhombusPath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.moveTo( cX, cY - rV )
	$.lineTo( cX + rH, cY )
	$.lineTo( cX, cY + rV )
	$.lineTo( cX - rH, cY )
	$.closePath()
	return	$
}

const
Corners			= ( aF, aT, [ xF, yF ], [ xT, yT ] ) => {

	const VHV	= () => {
		const y = ( yF + yT ) / 2
		return [ [ xF, y ], [ xT, y ] ]
	}
	const HVH	= () => {
		const x = ( xF + xT ) / 2
		return [ [ x, yF ], [ x, yT ] ]
	}
	const VH	= () => [ [ xF, yT ] ]
	const HV	= () => [ [ xT, yF ] ]
	const UHD	= () => {
		const y = Math.min( yF, yT ) - GRAB
		return [ [ xF, y ], [ xT, y ] ]
	}
	const DHU	= () => {
		const y = Math.max( yF, yT ) + GRAB
		return [ [ xF, y ], [ xT, y ] ]
	}
	const LVR	= () => {
		const x = Math.min( xF, xT ) - GRAB
		return [ [ x, yF ], [ x, yT ] ]
	}
	const RVL	= () => {
		const x = Math.max( xF, xT ) + GRAB
		return [ [ x, yF ], [ x, yT ] ]
	}

	switch ( aF ) {
	case 'T'	:
		switch ( aT ) {
		case 'T'	: return UHD()
		case 'B'	: return VHV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		case 'TL'	: return VH()
		case 'TR'	: return VH()
		case 'BL'	: return VH()
		case 'BR'	: return VH()
		default		: return VHV()
		}
	case 'B'	:
		switch ( aT ) {
		case 'T'	: return VHV()
		case 'B'	: return DHU()
		case 'L'	: return VH()
		case 'R'	: return VH()
		case 'TL'	: return VH()
		case 'TR'	: return VH()
		case 'BL'	: return VH()
		case 'BR'	: return VH()
		default		: return VHV()
		}
	case 'L'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return LVR()
		case 'R'	: return HVH()
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HVH()
		}
	case 'R'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return HVH()
		case 'R'	: return RVL()
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HVH()
		}
	case 'TL'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		//	TODO:
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HV()
		}
	case 'TR'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		//	TODO:
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HV()
		}
	case 'BL'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		//	TODO:
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HV()
		}
	case 'BR'	:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		//	TODO:
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return HV()
		}
	default		:
		//	TODO:
		switch ( aT ) {
		case 'T'	: return HV()
		case 'B'	: return HV()
		case 'L'	: return VH()
		case 'R'	: return VH()
		//	TODO:
		case 'TL'	: return HV()
		case 'TR'	: return HV()
		case 'BL'	: return HV()
		case 'BR'	: return HV()
		default		: return VHV()
		}
	}
}

export const
LinkCoordinates	= ( [ [ nF, nT ], A ] ) => {
	const
	onOutline		= ( S, dX, dY ) => {
		if	( !dX && !dY ) return [ S.cX, S.cY ]
		const	rH = Math.abs( S.rH ), rV = Math.abs( S.rV )
		let		scale
		switch ( S.type ) {
		case 'ellipse'	:
			scale = 1 / Math.hypot( dX / rH, dY / rV )
			break
		case 'rhombus'	:
			scale = 1 / ( Math.abs( dX ) / rH + Math.abs( dY ) / rV )
			break
		default			: {	//	rect, SVG, PNG: bounding-box edge
			const	sH = dX ? rH / Math.abs( dX ) : Infinity
			const	sV = dY ? rV / Math.abs( dY ) : Infinity
			scale = Math.min( sH, sV )
			}
		}
		return	[ S.cX + dX * scale, S.cY + dY * scale ]
	}
	const
	$ = ( S, A, s ) => {
		let	P
		switch	( A ) {
		case 'TL'	: P = [ L( S ), T( S ) ]; break
		case 'TR'	: P = [ R( S ), T( S ) ]; break
		case 'BL'	: P = [ L( S ), B( S ) ]; break
		case 'BR'	: P = [ R( S ), B( S ) ]; break
		case 'T'	: P = [ S.cX, T( S ) ]; break
		case 'B'	: P = [ S.cX, B( S ) ]; break
		case 'L'	: P = [ L( S ), S.cY ]; break
		case 'R'	: P = [ R( S ), S.cY ]; break
		default		: return onOutline( S, s.cX - S.cX, s.cY - S.cY )
		}
		//	anchored: rects keep the box point; ellipse / rhombus project onto the outline
		return	S.type === 'ellipse' || S.type === 'rhombus'
		?	onOutline( S, P[ 0 ] - S.cX, P[ 1 ] - S.cY )
		:	P
	}
,	aF = A.anchorF
,	aT = A.anchorT
,	pF = $( nF[ 1 ], aF, nT[ 1 ], aT )
,	pT = $( nT[ 1 ], aT, nF[ 1 ], aF )

,	autoPerp		= ( S, [ px, py ], aOther ) => {
		if	( S.type !== 'ellipse' && S.type !== 'rhombus' ) {
			const
			hasH = aOther.includes( 'L' ) || aOther.includes( 'R' )
		,	hasV = aOther.includes( 'T' ) || aOther.includes( 'B' )
			//	a horizontal segment reaches the L/R edge only if py is inside the
			//	box's vertical span; a vertical one reaches T/B only if px is inside
			//	its horizontal span
		,	canH = T( S ) < py && py < B( S )
		,	canV = L( S ) < px && px < R( S )
		,	toH  = () => [ px <= S.cX ? L( S ) : R( S ), py ]
		,	toV  = () => [ px, py <= S.cY ? T( S ) : B( S ) ]
			//	prefer the axis that matches the anchored end's side; otherwise, as
			//	an exception, still connect on whichever axis the edge admits
			if	( hasH && canH )	return toH()
			if	( hasV && canV )	return toV()
			if	( canH )			return toH()
			if	( canV )			return toV()
		}
		return	onOutline( S, px - S.cX, py - S.cY )
	}
	//	unanchored end: pick the side ( T / B / L / R ) the auto-computed point
	//	lands on, so corner routing treats it like an explicit anchor. Whichever
	//	of the box-normalized offsets dominates decides horizontal vs vertical.
,	sideOf		= ( S, [ px, py ] ) => {
		const
		dX = px - S.cX
	,	dY = py - S.cY
	,	rH = Math.abs( S.rH ) || 1
	,	rV = Math.abs( S.rV ) || 1
		return	Math.abs( dX ) / rH >= Math.abs( dY ) / rV
		?	( dX >= 0 ? 'R' : 'L' )
		:	( dY >= 0 ? 'B' : 'T' )
	}
	if	( !A.corner ) {
		if	( aF && !aT )	return [ pF, autoPerp( nT[ 1 ], pF, aF ) ]
		if	( aT && !aF )	return [ autoPerp( nF[ 1 ], pT, aT ), pT ]
	}
	return [ pF, pT, Corners( aF || sideOf( nF[ 1 ], pF ), aT || sideOf( nT[ 1 ], pT ), pF, pT ) ]
}

export const
IsStrokedHead	= _ => {
	switch	( _ ) {
	case 'open'				:
	case 'hollow'			:
	case 'diamondHollow'	:
	case 'circleHollow'		:
		return	true
	}
	return false
}


const
HeadMetrics		= ( head, shaftXY, tipXY, lineWidth ) => {
	const
	[ dX, dY ] = DeltaXY( tipXY, shaftXY )
,	len = Math.hypot( dX, dY )
	if	( len < 1e-9 || !head ) return null

	const
	lw = Number( lineWidth ) || 1
,	headLen  = Math.min( len * 0.35, Math.max( 10, lw * 2.4 ) )
,	headHalf = Math.max( 4, headLen * 0.45 )
,	dir = DivXY( [ dX, dY ], len )
,	normal = [ -dir[ 1 ], dir[ 0 ] ]
,	neck = AddXY( tipXY, MulXY( dir, headLen ) )
,	baseL = AddXY( neck, MulXY( normal, headHalf ) )
,	baseR = AddXY( neck, MulXY( normal, -headHalf ) )
	return	{ dir, normal, neck, baseL, baseR, headLen, headHalf }
}
const
SVGXY			= ( [ x, y ] ) => `${ x } ${ y }`
const
ARC_RADIUS		= 48	//	max fillet radius for the 'arc' corner style

export const
HeadNeck		= ( head, shaftXY, tipXY, lineWidth ) => {
	if	( !head || head === 'open' ) return tipXY
	const
	metrics = HeadMetrics( head, shaftXY, tipXY, lineWidth )
	return	metrics?.neck ?? tipXY
}

export const
HeadPath		= ( head, shaftXY, tipXY, lineWidth ) => {
	const
	$ = new Path2D()
,	metrics = HeadMetrics( head, shaftXY, tipXY, lineWidth )
	if	( !metrics ) return $
	const
	{ dir, normal, neck, baseL, baseR, headLen, headHalf } = metrics

	switch	( head ) {
	case 'open'				:
		$.moveTo( ...baseL )
		$.lineTo( ...tipXY )
		$.lineTo( ...baseR )
		break
	case 'hollow'			:
	case 'triangle'			:
		$.moveTo( ...tipXY )
		$.lineTo( ...baseL )
		$.lineTo( ...baseR )
		$.closePath()
		break
	case 'diamond'			:
	case 'diamondHollow'	:
		{	const
			center = AddXY( tipXY, MulXY( dir, headLen * 0.5 ) )
			$.moveTo( ...tipXY )
			$.lineTo( ...AddXY( center, MulXY( normal, headHalf ) ) )
			$.lineTo( ...neck )
			$.lineTo( ...AddXY( center, MulXY( normal, -headHalf ) ) )
			$.closePath()
		}
		break
	case 'circle'			:
	case 'circleHollow'		:
		$.arc(
			tipXY[ 0 ] + dir[ 0 ] * headLen * 0.5
		,	tipXY[ 1 ] + dir[ 1 ] * headLen * 0.5
		,	headLen * 0.5
		,	0
		,	Math.PI * 2
		)
		break
	default					:
		$.moveTo( ...tipXY )
		$.lineTo( ...baseL )
		$.lineTo( ...baseR )
		$.closePath()
	}
	return $
}
const
HeadPathD		= ( head, shaftXY, tipXY, lineWidth ) => {
	const
	metrics = HeadMetrics( head, shaftXY, tipXY, lineWidth )
	if	( !metrics ) return null
	const
	{ dir, normal, neck, baseL, baseR, headLen, headHalf } = metrics

	switch	( head ) {
	case 'open'				:
		return	`M ${ SVGXY( baseL ) } L ${ SVGXY( tipXY ) } L ${ SVGXY( baseR ) }`
	case 'hollow'			:
	case 'triangle'			:
		return	`M ${ SVGXY( tipXY ) } L ${ SVGXY( baseL ) } L ${ SVGXY( baseR ) } Z`
	case 'diamond'			:
	case 'diamondHollow'	: {
		const
		center = AddXY( tipXY, MulXY( dir, headLen * 0.5 ) )
		return	`M ${ SVGXY( tipXY ) }`
			+	` L ${ SVGXY( AddXY( center, MulXY( normal, headHalf ) ) ) }`
			+	` L ${ SVGXY( neck ) }`
			+	` L ${ SVGXY( AddXY( center, MulXY( normal, -headHalf ) ) ) } Z`
		}
	case 'circle'			:
	case 'circleHollow'		: {
		const
		r = headLen * 0.5
	,	c = AddXY( tipXY, MulXY( dir, r ) )
	,	l = [ c[ 0 ] - r, c[ 1 ] ]
	,	R = [ c[ 0 ] + r, c[ 1 ] ]
		return	`M ${ SVGXY( R ) } A ${ r } ${ r } 0 1 0 ${ SVGXY( l ) } A ${ r } ${ r } 0 1 0 ${ SVGXY( R ) } Z`
		}
	default					:
		return	`M ${ SVGXY( tipXY ) } L ${ SVGXY( baseL ) } L ${ SVGXY( baseR ) } Z`
	}
}


export const
ShaftPath		= ( [ [ nF, nT ], A, P], xyF, xyT, corners ) => {
	void nF
	void nT
	void P

	const
	$ = new Path2D
	$.moveTo( ...xyF )

	if	( A.corner ) {
		switch	( A.corner ) {
		case 'sharp':
			corners.forEach( _ => $.lineTo( ..._ ) )
			$.lineTo( ...xyT )
			break
		case 'arc':
			corners.reduce(
				( P, C, _ ) => {
					const
					N = corners[ _ + 1 ] ?? xyT
					,   R = Math.min(
							ARC_RADIUS
					,   Math.hypot( ...DeltaXY( P, C ) ) / 2
					,   Math.hypot( ...DeltaXY( C, N ) ) / 2
					)
					R < 1
					?	$.lineTo( ...C )
					:	$.arcTo( ...C, ...N, R )
					return C
				}
			,	xyF
			)
			$.lineTo( ...xyT )
			break
		case 'curve':
			switch	( corners.length ) {
			case 1:
				$.quadraticCurveTo( ...corners[ 0 ], ...xyT )
				break
			case 2:
				$.bezierCurveTo( ...corners[ 0 ], ...corners[ 1 ], ...xyT )
				break
			default:
				console.error( A.corner )
				$.lineTo( ...xyT )
				break
			}
			break
		}
	} else {
		$.lineTo( ...xyT )
	}
	return	$
}
const
ShaftPathD		= ( [ [ nF, nT ], A, P], xyF, xyT, corners ) => {
	void nF
	void nT
	void P
	let
	$ = `M ${ SVGXY( xyF ) }`

	if	( A.corner ) {
		switch	( A.corner ) {
		case 'sharp':
			return	$ + corners.map( _ => ` L ${ SVGXY( _ ) }` ).join( '' ) + ` L ${ SVGXY( xyT ) }`
		case 'arc':
			corners.reduce(
				( P, C, _ ) => {
					const
					N = corners[ _ + 1 ] ?? xyT
				,	R = Math.min(
						ARC_RADIUS
					,	Math.hypot( ...DeltaXY( P, C ) ) / 2
					,	Math.hypot( ...DeltaXY( C, N ) ) / 2
					)
					if	( R < 1 ) {
						$ += ` L ${ SVGXY( C ) }`
					} else {
						const
						inDir = DivXY( DeltaXY( P, C ), Math.hypot( ...DeltaXY( P, C ) ) )
					,	outDir = DivXY( DeltaXY( C, N ), Math.hypot( ...DeltaXY( C, N ) ) )
					,	a = AddXY( C, MulXY( inDir, -R ) )
					,	b = AddXY( C, MulXY( outDir, R ) )
					,	sweep = inDir[ 0 ] * outDir[ 1 ] - inDir[ 1 ] * outDir[ 0 ] > 0 ? 1 : 0
						$ += ` L ${ SVGXY( a ) } A ${ R } ${ R } 0 0 ${ sweep } ${ SVGXY( b ) }`
					}
					return C
				}
			,	xyF
			)
			return	$ + ` L ${ SVGXY( xyT ) }`
		case 'curve':
			switch	( corners.length ) {
			case 1:
				return	$ + ` Q ${ SVGXY( corners[ 0 ] ) } ${ SVGXY( xyT ) }`
			case 2:
				return	$ + ` C ${ SVGXY( corners[ 0 ] ) } ${ SVGXY( corners[ 1 ] ) } ${ SVGXY( xyT ) }`
			default:
				return	$ + ` L ${ SVGXY( xyT ) }`
			}
		}
	}
	return	$ + ` L ${ SVGXY( xyT ) }`
}

const
HeadShaftXY		= ( cornerXY, fallbackXY, tipXY ) => {
	if	( !cornerXY ) return fallbackXY
	return	Math.hypot( ...DeltaXY( tipXY, cornerXY ) ) < 1e-9 ? fallbackXY : cornerXY
}
const
ArrowGeometry	= _ => {
	const
	[ xyF, xyT, corners ] = LinkCoordinates( _ )
	const
	[ , A, P ]		= _

	const
	shaftF = HeadShaftXY( A.corner && corners[ 0 ], xyT, xyF )
,	shaftT = HeadShaftXY( A.corner && corners[ corners.length - 1 ], xyF, xyT )
,	trimF = HeadNeck( A.headF, shaftF, xyF, P.lineWidth )
,	trimT = HeadNeck( A.headT, shaftT, xyT, P.lineWidth )

	return	{ A, P, xyF, xyT, corners, shaftF, shaftT, trimF, trimT }
}
export const
ArrowPathes		= _ => {
	const
	{ A, P, xyF, xyT, corners, shaftF, shaftT, trimF, trimT } = ArrowGeometry( _ )
	return {
		shaftPath	: ShaftPath(
			_
		,	trimF
		,	trimT
		,	corners
		)

	,	headPathF	: A.headF
		?	HeadPath( A.headF, shaftF, xyF, P.lineWidth )
		:	null
	,	strokeF		: IsStrokedHead( A.headF )

	,	headPathT	: A.headT
		?	HeadPath( A.headT, shaftT, xyT, P.lineWidth )
		:	null
	,	strokeT		: IsStrokedHead( A.headT )

	,	xyF
	,	xyT
	,	corners
	}
}
export const
ArrowDs			= _ => {
	const
	{ A, P, xyF, xyT, corners, shaftF, shaftT, trimF, trimT } = ArrowGeometry( _ )
	return	{
		shaftD	: ShaftPathD( _, trimF, trimT, corners )
	,	headDF	: A.headF
		?	HeadPathD( A.headF, shaftF, xyF, P.lineWidth )
		:	null
	,	strokeF	: IsStrokedHead( A.headF )
	,	headDT	: A.headT
		?	HeadPathD( A.headT, shaftT, xyT, P.lineWidth )
		:	null
	,	strokeT	: IsStrokedHead( A.headT )
	}
}
