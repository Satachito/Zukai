import { test }	from 'node:test'
import assert	from 'node:assert/strict'

import {
	AddXY
,	SubXY
,	DivXY
,	MulXY
,	DeltaXY
,	EqualXY
,	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsXY
,	ContainsTLBR
,	AreaTLBR
,	Outset
,	Union
,	XYWH_XYXY
}	from '../Geo2D.js'

test( 'vector arithmetic', () => {
	assert.deepEqual( AddXY( [ 1, 2 ], [ 3, 4 ] ), [ 4, 6 ] )
	assert.deepEqual( SubXY( [ 5, 7 ], [ 2, 3 ] ), [ 3, 4 ] )
	assert.deepEqual( DivXY( [ 8, 4 ], 2 ), [ 4, 2 ] )
	assert.deepEqual( MulXY( [ 2, 3 ], 3 ), [ 6, 9 ] )
	//	DeltaXY( A, B ) = B - A
	assert.deepEqual( DeltaXY( [ 1, 2 ], [ 4, 6 ] ), [ 3, 4 ] )
	assert.ok( EqualXY( [ 1, 2 ], [ 1, 2 ] ) )
	assert.ok( !EqualXY( [ 1, 2 ], [ 1, 3 ] ) )
} )

test( 'TLBR_XYXY normalizes any two corners to [ T, L, B, R ]', () => {
	assert.deepEqual( TLBR_XYXY( [ [ 10, 20 ], [ 4, 50 ] ] ), [ 20, 4, 50, 10 ] )
	assert.deepEqual( TLBR_XYXY( [ [ 4, 50 ], [ 10, 20 ] ] ), [ 20, 4, 50, 10 ] )
} )

test( 'EdgeDist is signed ( + inside, - outside )', () => {
	assert.deepEqual( EdgeDist( [ 0, 0, 100, 100 ], [ 10, 20 ] ), [ 20, 10, 80, 90 ] )
	//	a point left of / above the box goes negative on those edges
	assert.deepEqual( EdgeDist( [ 0, 0, 100, 100 ], [ -5, -10 ] ), [ -10, -5, 110, 105 ] )
} )

test( 'ContainsXY / ContainsTLBR', () => {
	assert.ok( ContainsXY( [ 0, 0, 100, 100 ], [ 50, 50 ] ) )
	assert.ok( !ContainsXY( [ 0, 0, 100, 100 ], [ 150, 50 ] ) )
	assert.ok( ContainsTLBR( [ 0, 0, 100, 100 ], [ 10, 10, 90, 90 ] ) )
	assert.ok( !ContainsTLBR( [ 0, 0, 100, 100 ], [ -1, 10, 90, 90 ] ) )
} )

test( 'AreaTLBR / Outset', () => {
	assert.equal( AreaTLBR( [ 0, 0, 100, 50 ] ), 5000 )
	assert.deepEqual( Outset( [ 10, 10, 20, 20 ], 5 ), [ 5, 5, 25, 25 ] )
} )

test( 'Union covers every input rect', () => {
	assert.deepEqual( Union( [ [ 0, 0, 10, 10 ], [ 5, 5, 20, 20 ] ] ), [ 0, 0, 20, 20 ] )
	assert.deepEqual(
		Union( [ [ 5, 5, 6, 6 ], [ 0, 8, 4, 12 ], [ 2, 0, 30, 3 ] ] )
	,	[ 0, 0, 30, 12 ]
	)
} )

test( 'XYWH conversions', () => {
	assert.deepEqual( XYWH_TLBR( [ 10, 20, 50, 80 ] ), [ 20, 10, 60, 40 ] )
	assert.deepEqual( XYWH_XYXY( [ [ 10, 20 ], [ 40, 60 ] ] ), [ 10, 20, 30, 40 ] )
} )
