import { test }	from 'node:test'
import assert	from 'node:assert/strict'

import {
	validateModel
,	parseZuText
,	formatZuDoc
}	from '../../tools/zu-validate.mjs'

const
okNode	= ( id, extra = {} ) => [
	id
,	{ type: 'rect', cX: 100, cY: 100, rH: 40, rV: 20, ...extra }
,	{ stroke: 'gray' }
]

test( 'validateModel accepts a minimal valid diagram', () => {
	assert.deepEqual(
		validateModel( {
			nodes	: [ okNode( 'A' ), okNode( 'B', { cX: 300 } ) ]
		,	links	: [ [ [ 'A', 'B' ], { headT: 'triangle' }, {} ] ]
		} )
	,	[]
	)
} )

test( 'validateModel reports duplicate IDs and dangling links', () => {
	const
	issues = validateModel( {
		nodes	: [ okNode( 'A' ), okNode( 'A' ) ]
	,	links	: [ [ [ 'A', 'Z' ], {}, {} ] ]
	} )
	assert.ok( issues.some( _ => /duplicate node ID "A"/.test( _ ) ) )
	assert.ok( issues.some( _ => /to "Z" is not a node/.test( _ ) ) )
} )

test( 'validateModel rejects self-links, bad corners, and tiny nodes', () => {
	const
	issues = validateModel( {
		nodes	: [ [ 'A', { type: 'rect', cX: 0, cY: 0, rH: 1, rV: 1 }, {} ] ]
	,	links	: [
			[ [ 'A', 'A' ], {}, {} ]
		,	[ [ 'A', 'A' ], { corner: 'bezier' }, {} ]
		]
	} )
	assert.ok( issues.some( _ => /too small/.test( _ ) ) )
	assert.ok( issues.some( _ => /self-link/.test( _ ) ) )
	assert.ok( issues.some( _ => /corner must be/.test( _ ) ) )
} )

test( 'parseZuText requires model; formatZuDoc is stable JSON', () => {
	assert.throws( () => parseZuText( '{}' ), /must include "model"/ )
	const
	doc = { model: { nodes: [], links: [] } }
	assert.deepEqual( parseZuText( formatZuDoc( doc ) ), doc )
} )
