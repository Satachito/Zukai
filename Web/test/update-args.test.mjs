import { test }	from 'node:test'
import assert	from 'node:assert/strict'

import {
	updateNodeArgs
,	updateLinkArgs
}	from '../update-args.js'

const
node	= [
	'Cloud'
,	{ type: 'rect', cX: 100, cY: 100, rH: 80, rV: 40, html: 'Cloud' }
,	{ fill: '#e8f0fe', stroke: 'gray', lineWidth: 2 }
]

const
link	= [
	[ 'A', 'B' ]
,	{ headT: 'triangle', corner: 'sharp' }
,	{ stroke: 'navy', lineWidth: 2 }
]

test( 'updateNodeArgs keeps paint when omitted', () => {
	const
	area = { type: 'rect', cX: 120, cY: 100, rH: 80, rV: 40, html: 'Cloud' }
	assert.deepEqual(
		updateNodeArgs( { id: 'Cloud', area }, node )
	,	[ 'Cloud', area, node[ 2 ] ]
	)
} )

test( 'updateNodeArgs keeps area when omitted', () => {
	const
	paint = { fill: 'red' }
	assert.deepEqual(
		updateNodeArgs( { id: 'Cloud', paint }, node )
	,	[ 'Cloud', node[ 1 ], paint ]
	)
} )

test( 'updateNodeArgs renames via newId', () => {
	assert.deepEqual(
		updateNodeArgs( { id: 'Cloud', newId: 'Sky' }, node )
	,	[ 'Sky', node[ 1 ], node[ 2 ] ]
	)
} )

test( 'updateLinkArgs keeps ends and paint when omitted', () => {
	assert.deepEqual(
		updateLinkArgs( { from: 'A', to: 'B' }, link )
	,	[ [ 'A', 'B' ], link[ 1 ], link[ 2 ] ]
	)
} )

test( 'updateLinkArgs replaces ends only', () => {
	const
	ends = { headT: 'open' }
	assert.deepEqual(
		updateLinkArgs( { from: 'A', to: 'B', ends }, link )
	,	[ [ 'A', 'B' ], ends, link[ 2 ] ]
	)
} )

test( 'updateLinkArgs retargets endpoints', () => {
	assert.deepEqual(
		updateLinkArgs( { from: 'A', to: 'B', newFrom: 'A', newTo: 'C' }, link )
	,	[ [ 'A', 'C' ], link[ 1 ], link[ 2 ] ]
	)
} )
