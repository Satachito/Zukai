import { test }	from 'node:test'
import assert	from 'node:assert/strict'

//	GeoZU creates a shared 2D context at import time ( C2D ). The routing helpers
//	under test never touch it, so a minimal document stub whose canvas yields a
//	null context is enough to import the module in plain Node.
globalThis.document = { createElement: () => ( { getContext: () => null } ) }

const	{ LinkCoordinates } = await import( '../GeoZU.js' )

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
