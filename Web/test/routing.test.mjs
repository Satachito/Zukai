import { test }	from 'node:test'
import assert	from 'node:assert/strict'

//	GeoZU creates a shared 2D context at import time ( C2D ). The routing helpers
//	under test never touch it, so a minimal document stub whose canvas yields a
//	null context is enough to import the module in plain Node.
globalThis.document = { createElement: () => ( { getContext: () => null } ) }

const	{ LinkCoordinates, RotateShape, ImageFrame, ViaIndex, MovedVia } = await import( '../GeoZU.js' )

const
node	= ( id, S ) => [ id, S, {} ]
,	rect	= ( cX, cY, rH, rV ) => ( { type: 'rect', cX, cY, rH, rV } )
,	ellipse	= ( cX, cY, rH, rV ) => ( { type: 'ellipse', cX, cY, rH, rV } )

test( 'sharp R -> L routes HVH through the mid-x column', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF, pT, corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'L', corner: 'sharp' } ] )
	assert.deepEqual( pF, [ 150, 100 ] )
	assert.deepEqual( pT, [ 350, 300 ] )
	assert.deepEqual( corners, [ [ 250, 100 ], [ 250, 300 ] ] )
} )

test( 'sharp T -> B routes VHV through the mid-y row', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ , , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'T', anchorT: 'B', corner: 'sharp' } ] )
	assert.deepEqual( corners, [ [ 100, 200 ], [ 400, 200 ] ] )
} )

test( 'corner anchor TR folds to a cardinal exit toward the target', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	//	TR point is [ R, T ] = [ 150, 70 ]; target is down-right, so the horizontal
	//	edge ( R ) heads toward it → routes like R -> L ( HVH, mid-x = 250 )
	,	[ pF, , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'TR', anchorT: 'L', corner: 'sharp' } ] )
	assert.deepEqual( pF, [ 150, 70 ] )
	assert.deepEqual( corners, [ [ 250, 70 ], [ 250, 300 ] ] )
} )

test( 'same-side R -> R wraps around the right ( RVL )', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 300, 300, 50, 30 ) )
	,	[ pF, pT, corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'R', corner: 'sharp' } ] )
	//	both exit right; the shared vertical column is GRAB ( 8 ) past the rightmost edge
	const	x = Math.max( pF[ 0 ], pT[ 0 ] ) + 8
	assert.deepEqual( corners, [ [ x, pF[ 1 ] ], [ x, pT[ 1 ] ] ] )
} )

test( 'unanchored end snaps horizontally to a rect edge when vertically aligned', () => {
	const
	nF = node( 'F', rect( 100, 300, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	r = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R' } ] )	//	no corner, T end unanchored
	assert.equal( r.length, 2 )
	assert.deepEqual( r[ 0 ], [ 150, 300 ] )
	assert.deepEqual( r[ 1 ], [ 350, 300 ] )	//	meets nT's left edge at the same y
} )

test( 'unanchored end snaps horizontally onto an ellipse outline', () => {
	const
	nF = node( 'F', rect( 100, 300, 50, 30 ) )
	,	nT = node( 'T', ellipse( 400, 300, 50, 30 ) )
	,	r = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R' } ] )
	assert.deepEqual( r[ 1 ], [ 350, 300 ] )	//	ellipse's leftmost point at cY
} )

test( 'pin anchor attaches at its box fraction and routes from its nearest edge', () => {
	const
	nF = node( 'F', { ...rect( 100, 100, 50, 50 ), pins: { a: [ 0, 0.2 ] } } )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF, , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'a', anchorT: 'T', corner: 'sharp' } ] )
	//	[ 0, 0.2 ] → x = 50, y = 50 + 100 * 0.2 = 70; nearest edge L → routes L -> T ( HV )
	assert.deepEqual( pF, [ 50, 70 ] )
	assert.deepEqual( corners, [ [ 400, 70 ] ] )
} )

test( 'pin exit overrides the nearest edge', () => {
	const
	nF = node( 'F', { ...rect( 100, 100, 50, 50 ), pins: { a: [ 0, 0.2, 'T' ] } } )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ , , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'a', anchorT: 'L', corner: 'sharp' } ] )
	//	T -> L routes VH: up / down from the pin, then across
	assert.deepEqual( corners, [ [ 50, 300 ] ] )
} )

test( 'pins on an ellipse keep their exact point', () => {
	const
	nF = node( 'F', { ...ellipse( 100, 100, 50, 50 ), pins: { a: [ 0, 0 ] } } )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'a', anchorT: 'L' } ] )
	assert.deepEqual( pF, [ 50, 50 ] )
} )

test( 'unknown pin name falls back to the auto outline point', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 100, 50, 30 ) )
	,	[ pF ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'nope' } ] )
	assert.deepEqual( pF, [ 150, 100 ] )
} )

test( 'rotate turns pins with the node and their exits with them', () => {
	//	unrotated symbol 100 × 40 with a pin on its left edge; turned 90° clockwise the
	//	displayed box is 40 × 100 and the pin sits on the top edge, exiting upward
	const
	nF = node( 'F', { ...rect( 100, 100, 20, 50 ), rotate: 90, pins: { a: [ 0, 0.5 ] } } )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF, , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'a', anchorT: 'L', corner: 'sharp' } ] )
	assert.deepEqual( pF, [ 100, 50 ] )
	//	T -> L routes VH
	assert.deepEqual( corners, [ [ 100, 300 ] ] )
} )

test( 'rotate 180 mirrors a pin through the center and turns an explicit exit', () => {
	const
	nF = node( 'F', { ...rect( 100, 100, 50, 20 ), rotate: 180, pins: { a: [ 0, 0.25, 'T' ] } } )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF, , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'a', anchorT: 'L', corner: 'sharp' } ] )
	assert.deepEqual( pF, [ 150, 110 ] )
	//	exit T turned twice is B: B -> L routes VH
	assert.deepEqual( corners, [ [ 150, 300 ] ] )
} )

test( 'RotateShape swaps the half-sizes and cycles rotate back to none', () => {
	const
	S = { type: 'SVG', cX: 10, cY: 20, rH: 50, rV: 12, SVG: 'x' }
	,	q1 = RotateShape( S )
	assert.deepEqual( q1, { type: 'SVG', cX: 10, cY: 20, rH: 12, rV: 50, SVG: 'x', rotate: 90 } )
	const	q4 = RotateShape( RotateShape( RotateShape( q1 ) ) )
	assert.deepEqual( q4, S )
	assert.ok( !( 'rotate' in q4 ) )
} )

test( 'ImageFrame draws the unrotated box under a rotate transform', () => {
	assert.deepEqual(
		ImageFrame( { cX: 100, cY: 200, rH: 12, rV: 50, rotate: 90 } )
	,	{ x: 50, y: 188, w: 100, h: 24, transform: 'rotate(90 100 200)' }
	)
	assert.deepEqual(
		ImageFrame( { cX: 100, cY: 200, rH: 50, rV: 12 } )
	,	{ x: 50, y: 188, w: 100, h: 24, transform: '' }
	)
} )

test( 'via without corner is a polyline through the waypoints', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ pF, pT, corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'L', via: [ [ 200, 50 ], [ 300, 350 ] ] } ] )
	assert.deepEqual( [ pF, pT ], [ [ 150, 100 ], [ 350, 300 ] ] )
	assert.deepEqual( corners, [ [ 200, 50 ], [ 300, 350 ] ] )
} )

test( 'via with corner routes each leg orthogonally from the anchors', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	[ , , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'L', corner: 'sharp', via: [ [ 250, 200 ] ] } ] )
	//	leaves F horizontally then drops to the waypoint; arrives at T horizontally
	assert.deepEqual( corners, [ [ 250, 100 ], [ 250, 200 ], [ 250, 300 ] ] )
} )

test( 'via legs that are already aligned get no extra bend', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	//	a feedback-style loop: out to the right, over the top, back down into T's top
	,	[ , , corners ] = LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'T', corner: 'sharp', via: [ [ 200, 100 ], [ 200, 20 ], [ 400, 20 ] ] } ] )
	assert.deepEqual( corners, [ [ 200, 100 ], [ 200, 20 ], [ 400, 20 ] ] )
} )

test( 'an unanchored end aims at its nearest waypoint', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 100, 50, 30 ) )
	,	[ pF, pT ] = LinkCoordinates( [ [ nF, nT ], { via: [ [ 100, 300 ], [ 400, 300 ] ] } ] )
	assert.deepEqual( [ pF, pT ], [ [ 100, 130 ], [ 400, 130 ] ] )
} )

test( 'a direct link without waypoints still has no corners', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	assert.equal( LinkCoordinates( [ [ nF, nT ], { anchorF: 'R', anchorT: 'L' } ] ).length, 2 )
} )

test( 'ViaIndex places a new waypoint by the segment it was dropped on', () => {
	const
	nF = node( 'F', rect( 100, 100, 50, 30 ) )
	,	nT = node( 'T', rect( 400, 300, 50, 30 ) )
	,	A = { anchorF: 'R', anchorT: 'L', corner: 'sharp', via: [ [ 250, 200 ] ] }
	//	polyline: 150,100 → 250,100 → 250,200 ( waypoint ) → 250,300 → 350,300
	assert.equal( ViaIndex( [ [ nF, nT ], A ], [ 200, 104 ] ), 0 )
	assert.equal( ViaIndex( [ [ nF, nT ], A ], [ 254, 150 ] ), 0 )
	assert.equal( ViaIndex( [ [ nF, nT ], A ], [ 254, 260 ] ), 1 )
	assert.equal( ViaIndex( [ [ nF, nT ], A ], [ 300, 296 ] ), 1 )
} )

test( 'MovedVia carries waypoints only when both ends move by the same offset', () => {
	const
	A = { corner: 'sharp', via: [ [ 10, 20 ] ] }
	,	F = rect( 0, 0, 10, 10 ), T = rect( 100, 0, 10, 10 )
	,	moved = S => ( { ...S, cX: S.cX + 5, cY: S.cY - 3 } )
	assert.deepEqual( MovedVia( A, [ F, T ], [ moved( F ), moved( T ) ] ).via, [ [ 15, 17 ] ] )
	assert.equal( MovedVia( A, [ F, T ], [ moved( F ), T ] ), A )
	assert.equal( MovedVia( A, [ F, T ], [ F, T ] ), A )
} )
