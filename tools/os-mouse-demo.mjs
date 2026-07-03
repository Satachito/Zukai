#!/usr/bin/env node
//	Native macOS mouse demo for Zukai — real cursor, real offsetX/offsetY.
//
//	Uses cliclick (brew install cliclick) + optional 3-point calibration.
//	Opens the JSONs sample via URL so no toolbar aiming is needed for load.
//
//	Prerequisites:
//	  cd Web && npm run dev
//	  brew install cliclick
//
//	Run:
//	  node tools/os-mouse-demo.mjs              # calibrate, then demo
//	  node tools/os-mouse-demo.mjs --auto       # guess layout from Chrome window
//
//	Optional env:
//	  ZU_PORT=8080  ZU_BROWSER="Google Chrome"

import { execFileSync, spawnSync } from 'child_process'
import readline from 'readline'
import { setTimeout as sleep } from 'timers/promises'

const
PORT		= Number( process.env.ZU_PORT || process.env.PORT ) || 8080
,	BROWSER	= process.env.ZU_BROWSER || 'Google Chrome'
,	URL		= `http://localhost:${ PORT }/?zu=Samples/JSONs.zu`
,	AUTO		= process.argv.includes( '--auto' )
,	STEP		= 24
,	CHROME_TOP	= Number( process.env.ZU_CHROME_TOP ) || 105
,	TOPBAR_H	= Number( process.env.ZU_TOPBAR_H ) || 132
,	FOOTER_H	= Number( process.env.ZU_FOOTER_H ) || 36
,	NAV_W		= Number( process.env.ZU_NAV_W ) || 284
,	ASIDE_W		= Number( process.env.ZU_ASIDE_W ) || 284
,	log		= msg => console.log( `\n▶ ${ msg }` )
,	cliclick	= ( ...args ) => execFileSync( 'cliclick', args, { encoding: 'utf8' } )
,	needCliclick	= () => {
	if	( spawnSync( 'which', [ 'cliclick' ] ).status === 0 ) return
	console.error( 'cliclick not found. Install with: brew install cliclick' )
	process.exit( 1 )
}
,	parsePoint	= out => {
	const	m = out.trim().match( /(-?\d+)\s*,\s*(-?\d+)/ )
	if	( !m ) throw new Error( `cliclick p returned unexpected output: ${ out.trim() }` )
	return { x: +m[ 1 ], y: +m[ 2 ] }
}
,	point	= ( box, fx, fy ) => ( {
	x: Math.round( box.left + box.width * fx )
,	y: Math.round( box.top + box.height * fy )
} )
,	move	= p => cliclick( `m:${ p.x },${ p.y }` )
,	click	= p => ( move( p ), cliclick( `c:${ p.x },${ p.y }` ) )
,	typeText	= s => cliclick( `t:${ s.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ) }` )
,	osDrag	= async ( from, to, steps = STEP ) => {
	move( from )
	await sleep( 120 )
	cliclick( `dd:${ from.x },${ from.y }` )
	for	( let i = 1; i <= steps; i++ ) {
		const
		t = i / steps
		,	x = Math.round( from.x + ( to.x - from.x ) * t )
		,	y = Math.round( from.y + ( to.y - from.y ) * t )
		cliclick( `dm:${ x },${ y }` )
		await sleep( 20 )
	}
	cliclick( `du:${ to.x },${ to.y }` )
}
,	waitEnter	= msg => new Promise( resolve => {
	const	rl = readline.createInterface( { input: process.stdin, output: process.stdout } )
	rl.question( msg, () => ( rl.close(), resolve() ) )
} )
,	readMouse	= async label => {
	await waitEnter( `\n→ ${ label }\n  Move the mouse, then press Enter… ` )
	return parsePoint( cliclick( 'p' ) )
}
,	openBrowser	= () => {
	execFileSync( 'osascript', [ '-e', `
		tell application "${ BROWSER }"
			activate
			if (count of windows) = 0 then make new window
			set URL of active tab of front window to "${ URL }"
		end tell
	` ] )
}
,	chromeWindow	= () => {
	const	out = execFileSync( 'osascript', [ '-e', `
		tell application "System Events"
			tell process "${ BROWSER }"
				set frontmost to true
				tell window 1
					set {x, y} to position
					set {w, h} to size
					return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)
				end tell
			end tell
		end tell
	` ], { encoding: 'utf8' } )
	const	[ x, y, w, h ] = out.trim().split( ',' ).map( Number )
	if	( ![ x, y, w, h ].every( Number.isFinite ) ) throw new Error( `Could not read ${ BROWSER } window bounds` )
	return { x, y, w, h }
}
,	autoLayout	= () => {
	const
	win = chromeWindow()
	,	left = win.x + NAV_W
	,	top = win.y + CHROME_TOP + TOPBAR_H
	,	width = win.w - NAV_W - ASIDE_W
	,	height = win.h - CHROME_TOP - TOPBAR_H - FOOTER_H
	,	box = { left, top, width, height }
	,	createNode = {
		x: win.x + NAV_W + 360
	,	y: win.y + CHROME_TOP + 58
	}
	,	dialogInput = {
		x: win.x + win.w / 2
	,	y: win.y + win.h / 2 - 10
	}
	,	dialogOk = {
		x: win.x + win.w / 2 + 72
	,	y: win.y + win.h / 2 + 34
	}
	return { box, createNode, dialogInput, dialogOk }
}
,	calibrate	= async () => {
	log( 'Calibration — 3 points (canvas top-left, bottom-right, Create node checkbox)' )
	const
	tl = await readMouse( 'Canvas top-left (inside the drawing area)' )
	,	br = await readMouse( 'Canvas bottom-right' )
	,	createNode = await readMouse( 'Create node checkbox' )
	,	box = {
		left	: tl.x
	,	top		: tl.y
	,	width	: br.x - tl.x
	,	height	: br.y - tl.y
	}
	if	( box.width < 80 || box.height < 80 ) throw new Error( 'Canvas box too small — check calibration points' )
	const
	dialogInput = {
		x: Math.round( tl.x + box.width * .5 )
	,	y: Math.round( tl.y + box.height * .5 )
	}
	,	dialogOk = {
		x: dialogInput.x + 72
	,	y: dialogInput.y + 44
	}
	return { box, createNode, dialogInput, dialogOk }
}
,	runDemo	= async layout => {
	const
	{ box, createNode, dialogInput, dialogOk } = layout

	log( '1/4 — Sample loaded from URL' )
	await sleep( 800 )

	log( '2/4 — Drag to move a node' )
	await osDrag( point( box, .42, .38 ), point( box, .52, .44 ) )
	await sleep( 700 )

	log( '3/4 — Create node + drag' )
	click( createNode )
	await sleep( 250 )
	await osDrag( point( box, .58, .52 ), point( box, .72, .68 ), STEP + 8 )
	await sleep( 500 )

	log( '4/4 — New node dialog' )
	click( dialogInput )
	await sleep( 150 )
	typeText( `os-${ Date.now() }` )
	await sleep( 150 )
	click( dialogOk )
	await sleep( 400 )
	click( createNode )

	log( 'Done — real OS cursor demo finished' )
}

const
run	= async () => {
	needCliclick()
	log( `Open ${ URL } in ${ BROWSER }` )
	openBrowser()
	await sleep( 2500 )

	const
	layout = AUTO
		? ( log( 'Using --auto layout from Chrome window bounds' ), autoLayout() )
		: await calibrate()

	log( `Canvas ${ layout.box.width }×${ layout.box.height } at (${ layout.box.left }, ${ layout.box.top })` )
	await runDemo( layout )
}

run().catch( err => {
	console.error( err )
	process.exit( 1 )
} )
