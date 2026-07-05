#!/usr/bin/env node
//	Playwright mouse demo — visible drag / create on the Zukai canvas.
//
//	Zukai reads ev.offsetX/Y on the canvas, so Playwright's page.mouse alone
//	does not commit drags. This script moves the visible cursor and dispatches
//	matching pointer events on MAIN_EDITOR.reformer.
//
//	Prerequisites:
//	  cd Web && npm run dev          ( zu-server on :8281 )
//	  cd tools && npm install && npx playwright install chromium
//
//	Run:
//	  node tools/playwright-mouse-demo.mjs
//	  node tools/playwright-mouse-demo.mjs --headless

import { chromium } from 'playwright'

const
PORT	= Number( process.env.ZU_PORT || process.env.PORT ) || 8281
,	URL	= `http://localhost:${ PORT }/`
,	HEADLESS	= process.argv.includes( '--headless' )
,	SLOW_MO		= HEADLESS ? 0 : 80
,	STEP		= 28
,	sleep	= ms => new Promise( r => setTimeout( r, ms ) )
,	log	= msg => console.log( `\n▶ ${ msg }` )

const
canvasBox	= async page => {
	const
	el = page.locator( 'main-editor canvas' ).last()
	await el.waitFor( { state: 'visible', timeout: 15_000 } )
	const	box = await el.boundingBox()
	if	( !box ) throw new Error( 'Canvas bounding box not found' )
	return { el, box }
}
,	pointerOnCanvas	= ( type, fx, fy, buttons = 1 ) => ( {
	type
,	fx
,	fy
,	buttons
} )
,	canvasDrag	= async ( page, box, fx, fy, tx, ty, steps = STEP ) => {
	const
	abs = ( x, y ) => ( {
		x: box.x + box.width * x
	,	y: box.y + box.height * y
	} )
	,	fire = ev => page.evaluate( _ => {
		const
		c = document.getElementById( 'MAIN_EDITOR' ).reformer
		,	rect = c.getBoundingClientRect()
		,	e = new PointerEvent( _.type, {
			clientX		: rect.left + rect.width * _.fx
		,	clientY		: rect.top + rect.height * _.fy
		,	offsetX		: rect.width * _.fx
		,	offsetY		: rect.height * _.fy
		,	button		: 0
		,	buttons		: _.buttons
		,	pointerId	: 1
		,	pointerType	: 'mouse'
		,	isPrimary	: true
		,	bubbles		: true
		,	cancelable	: true
		} )
		c.dispatchEvent( e )
	}, ev )

	const
	start = abs( fx, fy )
	await page.mouse.move( start.x, start.y, { steps: 10 } )
	await fire( pointerOnCanvas( 'pointerdown', fx, fy ) )
	await page.mouse.down()
	await sleep( 80 )

	for	( let i = 1; i <= steps; i++ ) {
		const
		t = i / steps
		,	x = fx + ( tx - fx ) * t
		,	y = fy + ( ty - fy ) * t
		,	pt = abs( x, y )
		await page.mouse.move( pt.x, pt.y )
		await fire( pointerOnCanvas( 'pointermove', x, y ) )
		HEADLESS || await sleep( 16 )
	}

	await fire( pointerOnCanvas( 'pointerup', tx, ty, 0 ) )
	await page.mouse.up()
}

const
run	= async () => {
	log( `Open ${ URL }` )
	const
	browser = await chromium.launch( { headless: HEADLESS, slowMo: SLOW_MO } )
	,	page = await browser.newPage( { viewport: { width: 1440, height: 900 } } )

	try {
		await page.goto( URL, { waitUntil: 'networkidle' } )
		await page.locator( '#MAIN_EDITOR' ).waitFor( { state: 'attached' } )

		log( '1/4 — Load JSONs sample' )
		await page.locator( '#SAMPLE_JSONS' ).click()
		await sleep( 900 )

		const
		{ box } = await canvasBox( page )

		log( '2/4 — Drag to move a node (select mode)' )
		await canvasDrag( page, box, .42, .38, .52, .44 )
		await sleep( 700 )

		log( '3/4 — Create node mode + drag a new box' )
		await page.locator( '#CREATE_NODE' ).check()
		await sleep( 200 )
		await canvasDrag( page, box, .58, .52, .72, .68, STEP + 8 )
		await sleep( 400 )

		log( '4/4 — Confirm new-node dialog' )
		await page.locator( '#NODE_ID_DIALOG[open]' ).waitFor( { state: 'visible', timeout: 8000 } )
		await page.locator( '#NODE_ID_DIALOG_INPUT' ).fill( `pw-${ Date.now() }` )
		await page.locator( '#NODE_ID_DIALOG_OK' ).click()
		await sleep( 600 )
		await page.locator( '#CREATE_NODE' ).uncheck()

		log( 'Done — check the Playwright Chromium window' )
		if	( !HEADLESS ) await sleep( 2500 )
	} finally {
		await browser.close()
	}
}

run().catch( err => {
	console.error( err )
	process.exit( 1 )
} )
