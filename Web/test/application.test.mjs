import { test, beforeEach }	from 'node:test'
import assert				from 'node:assert/strict'

//	Application → GeoZU creates a 2D context at import time.
globalThis.document = { createElement: () => ( { getContext: () => null } ) }

//	Application.js expects browser globals. Stub the minimum surface.
const
store = new Map

globalThis.window		= globalThis
globalThis.localStorage	= {
	getItem		: k => ( store.has( k ) ? store.get( k ) : null )
,	setItem		: ( k, v ) => store.set( k, String( v ) )
,	removeItem	: k => store.delete( k )
}
globalThis.MAIN_EDITOR	= {
	clearInteraction	: () => {}
,	Draw				: async () => {}
,	setCanvasSize		: () => {}
}
globalThis.LINK_EDITOR	= { Sync: () => {} }
globalThis.PROMPT_TEXT	= { Sync: () => {} }

const {
	DoTypical
,	withoutHistory
,	Node
,	EditNode
,	FindNode
,	Link
,	EditLink
,	SetPrompt
,	JSONString
}	= await import( '../Application.js' )

import { dones, todos }	from '../Jobs.js'

const
resetApp	= () => {
	app.model	= { nodes: [], links: [] }
	app.reforms	= []
	app.prompt	= undefined
	dones.length = 0
	todos.length = 0
	store.clear()
}

beforeEach( resetApp )

const
area	= ( cX = 100 ) => ( { type: 'rect', cX, cY: 100, rH: 40, rV: 20 } )
,	paint	= ( fill = 'blue' ) => ( { fill, stroke: 'gray', lineWidth: 2 } )

test( 'DoTypical records one undo step', async () => {
	await Node( [ 'A', area(), paint() ] )
	assert.equal( app.model.nodes.length, 1 )
	assert.equal( dones.length, 1 )
	assert.equal( dones[ 0 ].label, 'ApplyNode' )
} )

test( 'withoutHistory suppresses nested undo entries', async () => {
	await DoTypical(
		'AI'
	,	() => withoutHistory(
			async () => {
				await Node( [ 'A', area(), paint() ] )
				await Node( [ 'B', area( 300 ), paint( 'red' ) ] )
			}
		)
	)
	assert.equal( app.model.nodes.length, 2 )
	assert.equal( dones.length, 1 )
	assert.equal( dones[ 0 ].label, 'AI' )
} )

test( 'DoTypical rolls back the whole mutation on throw', async () => {
	await Node( [ 'A', area(), paint() ] )
	dones.length = 0
	await assert.rejects(
		() => DoTypical(
			'AI'
		,	() => withoutHistory(
				async () => {
					await Node( [ 'B', area( 300 ), paint() ] )
					throw new Error( 'boom' )
				}
			)
		)
	,	/boom/
	)
	assert.equal( FindNode( 'B' ), undefined )
	assert.ok( FindNode( 'A' ) )
	assert.equal( dones.length, 0 )
} )

test( 'EditNode can keep existing paint while replacing area', async () => {
	await Node( [ 'Cloud', area(), paint( '#e8f0fe' ) ] )
	const
	before = structuredClone( FindNode( 'Cloud' )[ 2 ] )
	,	nextArea = { ...area( 120 ), html: 'Cloud' }
	await EditNode( 'Cloud', [ 'Cloud', nextArea, before ] )
	const
	node = FindNode( 'Cloud' )
	assert.deepEqual( node[ 1 ], nextArea )
	assert.deepEqual( node[ 2 ], before )
} )

test( 'EditLink can keep existing ends while changing paint', async () => {
	await Node( [ 'A', area(), paint() ] )
	await Node( [ 'B', area( 300 ), paint() ] )
	await Link( [ [ 'A', 'B' ], { headT: 'triangle' }, { stroke: 'navy' } ] )
	const
	ends = structuredClone( app.model.links[ 0 ][ 1 ] )
	await EditLink( [ 'A', 'B' ], [ [ 'A', 'B' ], ends, { stroke: 'crimson' } ] )
	assert.deepEqual( app.model.links[ 0 ][ 1 ], ends )
	assert.equal( app.model.links[ 0 ][ 2 ].stroke, 'crimson' )
} )

test( 'SetPrompt is one undoable step and serializes into the .zu', async () => {
	await SetPrompt( 'draw a floor plan' )
	assert.equal( app.prompt, 'draw a floor plan' )
	assert.equal( dones.length, 1 )
	assert.equal( JSON.parse( JSONString() ).prompt, 'draw a floor plan' )

	const { Undo, Redo } = await import( '../Jobs.js' )
	await Undo()
	assert.equal( app.prompt, undefined )
	assert.equal( 'prompt' in JSON.parse( JSONString() ), false )
	await Redo()
	assert.equal( app.prompt, 'draw a floor plan' )
} )

test( 'SetPrompt with an empty string clears the key', async () => {
	await SetPrompt( 'note' )
	await SetPrompt( '' )
	assert.equal( app.prompt, undefined )
	assert.equal( 'prompt' in JSON.parse( JSONString() ), false )
} )
