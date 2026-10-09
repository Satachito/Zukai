#!/usr/bin/env node
//	Generate ICONs/circuit-symbols.zip: schematic symbols for the left palette.
//	Each SVG declares its connection points on the root element as
//	data-zu-pins='{ "name": [ u, v, exit? ] }' ( see Web/SCHEMA.md ); placing the
//	symbol from the palette copies them into the node's shape.pins. Regenerate with:
//	  node tools/gen-circuit-symbols.mjs

import { mkdtemp, mkdir, writeFile, rm }	from 'node:fs/promises'
import { execFileSync }						from 'node:child_process'
import { tmpdir }							from 'node:os'
import path									from 'node:path'
import { fileURLToPath }					from 'node:url'

const
INK			= 'light-dark(#000000, #ffffff)'

//	filled shapes ( arrowheads ) on top of the stroked body
const
FILL		= d => `<path d="${ d }" fill="${ INK }"/>`

const
PATH		= d => `<path d="${ d }"/>`

const
CIRCLE		= ( cx, cy, r ) => `<circle cx="${ cx }" cy="${ cy }" r="${ r }"/>`

const
ZIGZAG_H	= y => `M0 ${ y }H20l5 -9l10 18l10 -18l10 18l10 -18l10 18l5 -9H100`

const
SYMBOLS		= [
	//	passive
	[ 'passive/resistor-h', 100, 24, PATH( ZIGZAG_H( 12 ) ), { a: [ 0, 0.5 ], b: [ 1, 0.5 ] } ]
,	[ 'passive/resistor-v', 24, 100
	,	PATH( 'M12 0V20l-9 5l18 10l-18 10l18 10l-18 10l18 10l-9 5V100' )
	,	{ a: [ 0.5, 0 ], b: [ 0.5, 1 ] }
	]
,	[ 'passive/potentiometer', 100, 40
	,	PATH( ZIGZAG_H( 30 ) ) + PATH( 'M50 0V12' ) + FILL( 'M45 11H55L50 20Z' )
	,	{ a: [ 0, 0.75 ], b: [ 1, 0.75 ], wiper: [ 0.5, 0 ] }
	]
,	[ 'passive/capacitor-h', 60, 40
	,	PATH( 'M0 20H26M34 20H60M26 4V36M34 4V36' )
	,	{ a: [ 0, 0.5 ], b: [ 1, 0.5 ] }
	]
,	[ 'passive/capacitor-v', 40, 60
	,	PATH( 'M20 0V26M20 34V60M4 26H36M4 34H36' )
	,	{ a: [ 0.5, 0 ], b: [ 0.5, 1 ] }
	]
,	[ 'passive/capacitor-polarized-h', 60, 40
	,	PATH( 'M0 20H26M35 20H60M26 4V36M38 4Q32 20 38 36M12 8H20M16 4V12' )
	,	{ '+': [ 0, 0.5 ], '-': [ 1, 0.5 ] }
	]
,	[ 'passive/capacitor-polarized-v', 40, 60
	,	PATH( 'M20 0V26M20 35V60M4 26H36M4 38Q20 32 36 38M4 16H12M8 12V20' )
	,	{ '+': [ 0.5, 0 ], '-': [ 0.5, 1 ] }
	]
,	[ 'passive/inductor-h', 100, 32
	,	PATH( 'M0 16H20a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0H100' )
	,	{ a: [ 0, 0.5 ], b: [ 1, 0.5 ] }
	]
,	[ 'passive/inductor-v', 32, 100
	,	PATH( 'M16 0V20a7.5 7.5 0 0 1 0 15a7.5 7.5 0 0 1 0 15a7.5 7.5 0 0 1 0 15a7.5 7.5 0 0 1 0 15V100' )
	,	{ a: [ 0.5, 0 ], b: [ 0.5, 1 ] }
	]
,	[ 'passive/fuse', 80, 20
	,	PATH( 'M0 10H80' ) + '<rect x="20" y="4" width="40" height="12"/>'
	,	{ a: [ 0, 0.5 ], b: [ 1, 0.5 ] }
	]

	//	semiconductor
,	[ 'semiconductor/diode-h', 80, 30
	,	PATH( 'M0 15H25M50 15H80M50 3V27M25 3V27L50 15Z' )
	,	{ anode: [ 0, 0.5 ], cathode: [ 1, 0.5 ] }
	]
,	[ 'semiconductor/diode-v', 30, 80
	,	PATH( 'M15 0V25M15 50V80M3 50H27M3 25H27L15 50Z' )
	,	{ anode: [ 0.5, 0 ], cathode: [ 0.5, 1 ] }
	]
,	[ 'semiconductor/zener-h', 80, 30
	,	PATH( 'M0 15H25M50 15H80M45 1L50 3V27L55 29M25 3V27L50 15Z' )
	,	{ anode: [ 0, 0.5 ], cathode: [ 1, 0.5 ] }
	]
,	[ 'semiconductor/led-h', 80, 40
	,	PATH( 'M0 26H25M50 26H80M50 14V38M25 14V38L50 26ZM34 10L41 3M46 10L53 3' )
	+	FILL( 'M44 0L37.7 3.1L41.9 7.3Z' ) + FILL( 'M56 0L49.7 3.1L53.9 7.3Z' )
	,	{ anode: [ 0, 0.65 ], cathode: [ 1, 0.65 ] }
	]
,	[ 'semiconductor/npn', 64, 80
	,	CIRCLE( 36, 40, 24 ) + PATH( 'M0 40H22M22 26V54M22 34L48 20V0M22 46L48 60V80' )
	+	FILL( 'M44.1 57.9L36.3 57.7L39.6 51.5Z' )
	,	{ base: [ 0, 0.5 ], collector: [ 0.75, 0 ], emitter: [ 0.75, 1 ] }
	]
,	[ 'semiconductor/pnp', 64, 80
	,	CIRCLE( 36, 40, 24 ) + PATH( 'M0 40H22M22 26V54M22 34L48 20V0M22 46L48 60V80' )
	+	FILL( 'M28.5 30.5L36.3 30.3L33 24.1Z' )
	,	{ base: [ 0, 0.5 ], emitter: [ 0.75, 0 ], collector: [ 0.75, 1 ] }
	]
,	[ 'semiconductor/nmos', 64, 80
	,	PATH( 'M0 40H16M16 24V56M24 20V60M24 28H48V0M24 52H48V80' ) + FILL( 'M42 52L35 48.5V55.5Z' )
	,	{ gate: [ 0, 0.5 ], drain: [ 0.75, 0 ], source: [ 0.75, 1 ] }
	]
,	[ 'semiconductor/pmos', 64, 80
	,	PATH( 'M0 40H16M16 24V56M24 20V60M24 28H48V0M24 52H48V80' ) + FILL( 'M30 28L37 24.5V31.5Z' )
	,	{ gate: [ 0, 0.5 ], source: [ 0.75, 0 ], drain: [ 0.75, 1 ] }
	]
,	[ 'semiconductor/opamp', 180, 200
	,	PATH( 'M0 40H30M0 160H30M170 100H180M30 0V200L170 100ZM40 40H52M40 160H52M46 154V166' )
	,	{ 'in-': [ 0, 0.2 ], 'in+': [ 0, 0.8 ], out: [ 1, 0.5 ] }
	]
	//	+ on top: lets two op-amps face their − inputs ( instrumentation amp input stage )
,	[ 'semiconductor/opamp-flipped', 180, 200
	,	PATH( 'M0 40H30M0 160H30M170 100H180M30 0V200L170 100ZM40 40H52M40 160H52M46 34V46' )
	,	{ 'in+': [ 0, 0.2 ], 'in-': [ 0, 0.8 ], out: [ 1, 0.5 ] }
	]

	//	source
,	[ 'source/ground', 40, 30
	,	PATH( 'M20 0V10M0 10H40M8 18H32M15 26H25' )
	,	{ gnd: [ 0.5, 0 ] }
	]
,	[ 'source/vcc', 40, 30
	,	PATH( 'M20 30V8M6 8H34' )
	,	{ vcc: [ 0.5, 1 ] }
	]
,	[ 'source/battery', 40, 60
	,	PATH( 'M20 0V24M20 32V60M4 24H36M28 14H36M32 10V18' ) + '<path d="M12 32H28" stroke-width="4"/>'
	,	{ '+': [ 0.5, 0 ], '-': [ 0.5, 1 ] }
	]
,	[ 'source/voltage-dc', 60, 80
	,	CIRCLE( 30, 40, 26 ) + PATH( 'M30 0V14M30 66V80M30 22V34M24 28H36M24 52H36' )
	,	{ '+': [ 0.5, 0 ], '-': [ 0.5, 1 ] }
	]
,	[ 'source/voltage-ac', 60, 80
	,	CIRCLE( 30, 40, 26 ) + PATH( 'M30 0V14M30 66V80M16 40q7 -14 14 0t14 0' )
	,	{ a: [ 0.5, 0 ], b: [ 0.5, 1 ] }
	]
,	[ 'source/current-source', 60, 80
	,	CIRCLE( 30, 40, 26 ) + PATH( 'M30 0V14M30 66V80M30 56V30' ) + FILL( 'M30 22L25 30H35Z' )
	,	{ out: [ 0.5, 0 ], in: [ 0.5, 1 ] }
	]

	//	switch
,	[ 'switch/switch-h', 80, 40
	,	PATH( 'M0 28H20M60 28H80M24 27L56 8' ) + CIRCLE( 22, 28, 2 ) + CIRCLE( 58, 28, 2 )
	,	{ a: [ 0, 0.7 ], b: [ 1, 0.7 ] }
	]
]

const
SVG			= ( w, h, body, pins ) => `<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }" fill="none" stroke="${ INK }" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-zu-pins='${ JSON.stringify( pins ) }'>${ body }</svg>\n`

const
ROOT		= path.join( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	OUT			= path.join( ROOT, 'ICONs', 'circuit-symbols.zip' )
,	work		= await mkdtemp( path.join( tmpdir(), 'circuit-symbols-' ) )

try {
	for ( const [ name, w, h, body, pins ] of SYMBOLS ) {
		const	file = path.join( work, `${ name }.svg` )
		await mkdir( path.dirname( file ), { recursive: true } )
		await writeFile( file, SVG( w, h, body, pins ) )
	}
	await rm( OUT, { force: true } )
	execFileSync( 'zip', [ '-qrX', OUT, '.' ], { cwd: work } )
	console.log( `${ SYMBOLS.length } symbols → ${ path.relative( ROOT, OUT ) }` )
} finally {
	await rm( work, { recursive: true, force: true } )
}
