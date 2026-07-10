import { test, beforeEach }	from 'node:test'
import assert				from 'node:assert/strict'

import Do, { Undo, Redo, dones, todos }	from '../Jobs.js'

beforeEach( () => {
	dones.length = 0
	todos.length = 0
} )

test( 'Do records a redo/undo pair and clears the redo stack', async () => {
	const
	log = []
	await Do( 'one', async () => log.push( 'redo1' ), async () => log.push( 'undo1' ) )
	assert.deepEqual( log, [ 'redo1' ] )
	assert.equal( dones.length, 1 )
	assert.equal( dones[ 0 ].label, 'one' )

	await Do( 'two', async () => log.push( 'redo2' ), async () => log.push( 'undo2' ) )
	todos.push( { label: 'stale' } )	//	simulate leftover redo
	await Do( 'three', async () => log.push( 'redo3' ), async () => log.push( 'undo3' ) )
	assert.equal( todos.length, 0 )
	assert.equal( dones.length, 3 )
} )

test( 'Undo / Redo move entries between stacks', async () => {
	const
	v = { n: 0 }
	await Do( 'inc', async () => { v.n = 1 }, async () => { v.n = 0 } )
	await Undo()
	assert.equal( v.n, 0 )
	assert.equal( dones.length, 0 )
	assert.equal( todos.length, 1 )
	await Redo()
	assert.equal( v.n, 1 )
	assert.equal( dones.length, 1 )
	assert.equal( todos.length, 0 )
} )

test( 'Undo / Redo are no-ops on empty stacks', async () => {
	await Undo()
	await Redo()
	assert.equal( dones.length, 0 )
	assert.equal( todos.length, 0 )
} )
