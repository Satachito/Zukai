import { test } from 'node:test'
import assert from 'node:assert/strict'

const { track } = await import( '../Analytics.js' )

test( 'track sends only the named event to gtag', () => {
	const calls = []
	globalThis.gtag = ( ...args ) => calls.push( args )
	track( 'sample_open' )
	assert.deepEqual( calls, [ [ 'event', 'sample_open' ] ] )
	delete globalThis.gtag
} )

test( 'track tolerates unavailable analytics', () => {
	delete globalThis.gtag
	assert.doesNotThrow( () => track( 'export_svg' ) )
} )
