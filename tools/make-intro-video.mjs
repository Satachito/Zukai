#!/usr/bin/env node
//	Build the Zukai YouTube intro video ( Japanese and English ).
//
//	Captured app footage + rendered title cards + macOS `say` narration,
//	assembled with ffmpeg. Copy lives in tools/intro-script.mjs.
//
//	Prerequisites:
//	  cd Web && npm run dev            ( zu-server on :8281 )
//	  cd tools && npm install          ( playwright; uses the system Chrome )
//	  ffmpeg on PATH
//	  the narration engines named in tools/intro-script.mjs VOICE — by default
//	  VOICEVOX running ( ja ) and a local voiceger / GPT-SoVITS install ( en )
//
//	Run:
//	  node tools/make-intro-video.mjs                  both languages
//	  node tools/make-intro-video.mjs --lang ja
//	  node tools/make-intro-video.mjs --skip-capture   reuse cached footage
//
//	Output ( promo/youtube/ ):
//	  zukai-intro-ja.mp4 / zukai-intro-en.mp4  1920x1080 h264 + aac
//	  zukai-intro-ja.ja.srt / .en.srt          subtitles for both languages
//
//	Note: the AI segment reproduces the result of the prompt it shows — the
//	after state is loaded from Samples/MultiCloudPromoAfter.zu, so no API key
//	is needed to build the video.

import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEGMENTS, VOICE, LINK } from './intro-script.mjs'
import {
	W, H, FPS
,	sleep, log, mkdir, fresh, sh
,	narrate, renderStills, recorder, saveCount, assemble
} from './video-kit.mjs'

const
ROOT		= path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	OUT_DIR	= path.join( ROOT, 'promo', 'youtube' )
,	WORK	= process.env.ZU_INTRO_WORK || path.join( os.tmpdir(), 'zukai-intro' )
,	PORT	= Number( process.env.ZU_PORT || process.env.PORT ) || 8281
,	APP		= `http://127.0.0.1:${ PORT }/`
,	PER_LANG	= new Set( [ 'ai' ] )	//	shots whose footage differs per language
,	shotDir	= ( seg, lang ) => path.join( WORK, 'shots', PER_LANG.has( seg.id ) ? `${ seg.id }-${ lang }` : seg.id )

const
argv		= process.argv.slice( 2 )
,	argOf	= name => {
	const	i = argv.indexOf( name )
	return	i < 0 ? null : argv[ i + 1 ]
}
,	LANGS	= ( _ => {
	const	v = argOf( '--lang' )
	return	!v || v === 'both' ? [ 'ja', 'en' ] : [ v ]
} )()
,	SKIP_CAPTURE	= argv.includes( '--skip-capture' )


//	────────────────────────────────────────────────────────────  cards

const
ZU_SNIPPET	= `<span class=p>{</span>
  <span class=k>"model"</span>: <span class=p>{</span>
    <span class=k>"nodes"</span>: <span class=p>[</span>
      <span class=p>[</span> <span class=s>"WAF"</span>, <span class=p>{</span> <span class=k>"type"</span>: <span class=s>"rect"</span>
             , <span class=k>"cX"</span>: <span class=n>640</span>, <span class=k>"cY"</span>: <span class=n>300</span>
             , <span class=k>"rH"</span>: <span class=n>120</span>, <span class=k>"rV"</span>: <span class=n>44</span> <span class=p>}</span>, <span class=p>{}</span> <span class=p>]</span>,
      <span class=p>[</span> <span class=s>"API"</span>, <span class=p>{</span> <span class=k>"type"</span>: <span class=s>"rect"</span>
             , <span class=k>"cX"</span>: <span class=n>640</span>, <span class=k>"cY"</span>: <span class=n>520</span>
             , <span class=k>"rH"</span>: <span class=n>120</span>, <span class=k>"rV"</span>: <span class=n>44</span> <span class=p>}</span>, <span class=p>{}</span> <span class=p>]</span>
    <span class=p>]</span>,
    <span class=k>"links"</span>: <span class=p>[</span>
      <span class=p>[ [</span> <span class=s>"WAF"</span>, <span class=s>"API"</span> <span class=p>]</span>, <span class=p>{}</span>, <span class=p>{}</span> <span class=p>]</span>
    <span class=p>]</span>
  <span class=p>}</span>
<span class=p>}</span>`

const
CARDS	= {
	title	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=wrap>
		<div class=word>Zukai</div>
		<div class=tag>${ lang === 'ja' ? 'クラウド構成図を、AIと一緒に。' : 'Build cloud diagrams with AI.' }</div>
		<div class=tag2>${ lang === 'ja' ? 'Build cloud diagrams with AI.' : 'クラウド構成図を、AIと一緒に。' }</div>
		<div class=chips>${
			( lang === 'ja'
			?	[ '無料', 'オープンソース', '登録不要' ]
			:	[ 'Free', 'Open source', 'No sign-up' ]
			).map( _ => `<span>${ _ }</span>` ).join( '' )
		}</div>
		<div class=url>${ LINK }</div>
	</div>`
,	json	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=split>
		<div class=code>${ ZU_SNIPPET }</div>
		<div class=bullets>
			<div class=kicker>.ZU FORMAT</div>
			<h2>${ lang === 'ja' ? '図はただのJSON。<br>人にもAIにも読める。' : 'A diagram is plain JSON.<br>Readable by humans and AI.' }</h2>
			<ul>${
				( lang === 'ja'
				?	[ 'Gitで差分レビューできる', '手でもAIでも編集できる', 'SVG / PDF 書き出し・Figmaへ貼り付け' ]
				:	[ 'Review diffs in Git', 'Edit by hand or with AI', 'Export SVG / PDF · paste into Figma' ]
				).map( _ => `<li>${ _ }</li>` ).join( '' )
			}</ul>
		</div>
	</div>`
,	end	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=wrap>
		<div class=word>Zukai</div>
		<div class=tag>${ lang === 'ja' ? '無料・オープンソース・登録不要' : 'Free · Open source · No sign-up' }</div>
		<div class=tag2>${ lang === 'ja' ? 'ブラウザで、今すぐ。' : 'Start in your browser, right now.' }</div>
		<div class=url>${ LINK }</div>
	</div>`
}


//	────────────────────────────────────────────────────────────  app footage

//	Zukai reads pointer events on MAIN_EDITOR.reformer ( the canvas ), so drags
//	are dispatched there directly; a fake cursor is drawn because headless
//	screenshots never contain the real pointer.
const
CURSOR	= `
	const c = document.createElement( 'div' )
	c.id = '__cursor'
	c.style.cssText = 'position:fixed;left:-100px;top:-100px;width:26px;height:26px;z-index:2147483647;pointer-events:none;transition:transform .08s'
	c.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2 L4 21 L9.2 16.4 L12.6 24 L15.8 22.5 L12.4 15.2 L19.5 15 Z" fill="#fff" stroke="#0b1020" stroke-width="1.6" stroke-linejoin="round"/></svg>'
	document.body.appendChild( c )
`

const
cursorTo	= ( page, x, y ) => page.evaluate( ( [ x, y ] ) => {
	const	c = document.getElementById( '__cursor' )
	if	( c ) { c.style.left = `${ x }px`; c.style.top = `${ y }px` }
}, [ x, y ] )

,	pointer	= ( page, type, x, y, buttons = 1 ) => page.evaluate( ( [ type, x, y, buttons ] ) => {
	const
	c	= document.getElementById( 'MAIN_EDITOR' ).reformer
	,	r	= c.getBoundingClientRect()
	,	cx	= r.left + x
	,	cy	= r.top + y
	c.dispatchEvent( new PointerEvent( type, {
		clientX: cx, clientY: cy, button: 0, buttons
	,	pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true
	} ) )
	const	cur = document.getElementById( '__cursor' )
	if	( cur ) { cur.style.left = `${ cx }px`; cur.style.top = `${ cy }px` }
}, [ type, x, y, buttons ] )

//	drag in canvas content coordinates
,	drag	= async ( page, rec, from, to, sec = 1.1 ) => {
	await pointer( page, 'pointermove', from[ 0 ], from[ 1 ], 0 )
	await rec.hold( .25 )
	await pointer( page, 'pointerdown', from[ 0 ], from[ 1 ] )
	await rec.hold( .15 )
	await rec.tween( sec, async t => {
		await pointer( page, 'pointermove', from[ 0 ] + ( to[ 0 ] - from[ 0 ] ) * t, from[ 1 ] + ( to[ 1 ] - from[ 1 ] ) * t )
	} )
	await pointer( page, 'pointerup', to[ 0 ], to[ 1 ], 0 )
	await rec.hold( .3 )
}

//	move the fake cursor onto a DOM element, then click it for real
,	clickEl	= async ( page, rec, locator, sec = .55 ) => {
	const	box = await locator.boundingBox()
	if	( box ) {
		const	pos = await page.evaluate( () => {
			const	c = document.getElementById( '__cursor' )
			return	[ parseFloat( c.style.left ) || 0, parseFloat( c.style.top ) || 0 ]
		} )
		const	tx = box.x + box.width / 2, ty = box.y + box.height / 2
		await rec.tween( sec, async t => cursorTo( page, pos[ 0 ] + ( tx - pos[ 0 ] ) * t, pos[ 1 ] + ( ty - pos[ 1 ] ) * t ) )
	}
	await locator.click()
	await rec.hold( .3 )
}

,	newPage	= async ( browser, rec, { nav = true, aside = true } = {} ) => {
	const
	ctx		= await browser.newContext( { viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' } )
	await ctx.addInitScript( ( [ nav, aside ] ) => {
		localStorage.setItem( 'nav-collapsed', nav ? '' : '1' )
		localStorage.setItem( 'aside-collapsed', aside ? '' : '1' )
		localStorage.removeItem( 'tokyo.828.zukai' )
	}, [ nav, aside ] )
	const	page = await ctx.newPage()
	rec.page	= page
	await page.goto( APP, { waitUntil: 'networkidle' } )
	await page.locator( '#MAIN_EDITOR' ).waitFor( { state: 'attached' } )
	await page.evaluate( CURSOR )
	await sleep( 400 )
	return	{ ctx, page }
}

const
SHOTS	= {
	//	samples load with one click — MultiCloud, a slow pan, then two more
	overview	: async ( browser, rec ) => {
		const	{ ctx, page } = await newPage( browser, rec )
		await cursorTo( page, W * .58, H * .55 )
		await rec.hold( .8 )
		await clickEl( page, rec, page.locator( '#SAMPLE_MULTICLOUD' ), .7 )
		await sleep( 700 )
		await rec.hold( .8 )
		await clickEl( page, rec, page.locator( '#NAV_TOGGLE' ), .45 )
		await clickEl( page, rec, page.locator( '#ASIDE_TOGGLE' ), .45 )
		await rec.hold( .5 )
		const	span = await page.evaluate( () => {
			const	m = document.getElementById( 'MAIN_EDITOR' )
			return	[ m.scrollHeight - m.clientHeight, m.scrollWidth - m.clientWidth ]
		} )
		await rec.tween( 3, async t => page.evaluate( ( [ y, x ] ) => {
			const	m = document.getElementById( 'MAIN_EDITOR' )
			m.scrollTop = y; m.scrollLeft = x
		}, [ span[ 0 ] * t, span[ 1 ] * t * .55 ] ) )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( '#SAMPLE_MINDMAP' ), .5 )
		await sleep( 600 )
		await rec.hold( 1.3 )
		await clickEl( page, rec, page.locator( '#SAMPLE_SEQUENCE' ), .5 )
		await sleep( 600 )
		await rec.hold( .5 )
		await ctx.close()
	}

	//	cloud icon palettes — expand AWS, place two icons, arrange them
,	icons	: async ( browser, rec ) => {
		const	{ ctx, page } = await newPage( browser, rec, { aside: false } )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( 'nav cloud-icons[name=AWS] > details > summary' ), .6 )
		await sleep( 900 )
		await rec.hold( .4 )
		await clickEl( page, rec, page.locator( 'nav cloud-icons[name=AWS] details details > summary' ).nth( 1 ), .5 )
		await sleep( 900 )
		await rec.hold( .3 )
		await clickEl( page, rec, page.locator( 'nav cloud-icons[name=AWS] summary', { hasText: 'Arch_Compute' } ).first(), .5 )
		await sleep( 900 )
		await clickEl( page, rec, page.locator( 'nav cloud-icons[name=AWS] summary', { hasText: /^64$/ } ).first(), .45 )
		await sleep( 1400 )
		await rec.hold( .5 )
		const	rows = page.locator( 'nav cloud-icons[name=AWS] div[path]' )
		for ( const [ idx, target ] of [ [ 3, [ 620, 300 ] ], [ 7, [ 980, 300 ] ] ] ) {
			await clickEl( page, rec, rows.nth( idx ), .5 )
			await sleep( 400 )
			const	node = await page.evaluate( () => {
				const	m = window.ZU.getModel()
				return	m.nodes[ m.nodes.length - 1 ]
			} )
			await drag( page, rec, [ node[ 1 ].cX, node[ 1 ].cY ], target, .9 )
			//	park the pointer on empty canvas so the hover badge clears
			await pointer( page, 'pointermove', target[ 0 ] + 260, target[ 1 ] + 220, 0 )
			await rec.hold( .3 )
		}
		await rec.hold( .5 )
		await ctx.close()
	}

	//	direct editing — create two shapes, link them, move one
,	edit	: async ( browser, rec ) => {
		const	{ ctx, page } = await newPage( browser, rec )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( '#CREATE_NODE' ), .5 )
		await drag( page, rec, [ 420, 260 ], [ 700, 420 ], 1 )
		await page.locator( '#NODE_ID_DIALOG[open]' ).waitFor( { state: 'visible', timeout: 8000 } )
		await rec.hold( .3 )
		await page.locator( '#NODE_ID_DIALOG_INPUT' ).fill( 'API Gateway' )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( '#NODE_ID_DIALOG_OK' ), .4 )
		await drag( page, rec, [ 900, 620 ], [ 1180, 780 ], 1 )
		await page.locator( '#NODE_ID_DIALOG[open]' ).waitFor( { state: 'visible', timeout: 8000 } )
		await rec.hold( .3 )
		await page.locator( '#NODE_ID_DIALOG_INPUT' ).fill( 'Database' )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( '#NODE_ID_DIALOG_OK' ), .4 )
		await clickEl( page, rec, page.locator( '#CREATE_NODE' ), .35 )
		await clickEl( page, rec, page.locator( '#CREATE_LINK' ), .35 )
		await drag( page, rec, [ 560, 340 ], [ 1040, 700 ], 1.1 )
		await rec.hold( .5 )
		await clickEl( page, rec, page.locator( '#CREATE_LINK' ), .35 )
		//	links keep following their nodes
		await drag( page, rec, [ 1040, 700 ], [ 1320, 560 ], 1 )
		await rec.hold( .5 )
		await ctx.close()
	}

	//	AI editing — type the prompt, then show the result of that prompt
,	ai	: async ( browser, rec, lang ) => {
		const	{ ctx, page } = await newPage( browser, rec, { nav: false } )
		await clickEl( page, rec, page.locator( '#SAMPLE_MULTICLOUD' ), .5 )
		await sleep( 800 )
		await rec.tween( 1.4, async t => page.evaluate( y => { document.getElementById( 'MAIN_EDITOR' ).scrollTop = y }, 520 * t ) )
		const
		box		= page.locator( '#AI_PANEL textarea.ai-input' ).first()
		,	prompt	= lang === 'ja' ? 'VPNの帯を1.2倍高くして' : 'Make the VPN band 1.2× taller'
		await clickEl( page, rec, box, .6 )
		for	( const ch of [ ...prompt ] ) {
			await page.keyboard.type( ch )
			await rec.grab()
		}
		await rec.hold( 1.2 )
		await page.evaluate( async () => {
			const	res = await fetch( 'Samples/MultiCloudPromoAfter.zu' )
			window.ZU.setModel( ( await res.json() ).model )
		} )
		//	ring the node the prompt asked about, so a 1.2× change reads on video
		await page.evaluate( () => {
			const
			m	= document.getElementById( 'MAIN_EDITOR' )
			,	c	= m.reformer.getBoundingClientRect()
			,	n	= window.ZU.getModel().nodes.find( _ => _[ 0 ] === 'VPN' )[ 1 ]
			,	d	= document.createElement( 'div' )
			d.id = '__ring'
			d.style.cssText = `position:fixed;left:${ c.left + n.cX - n.rH - 18 }px;top:${ c.top + n.cY - n.rV - 18 }px`
				+ `;width:${ 2 * n.rH + 36 }px;height:${ 2 * n.rV + 36 }px;border:3px solid #a78bfa;border-radius:18px`
				+ ';box-shadow:0 0 34px rgba(167,139,250,.75);pointer-events:none;z-index:2147483646;opacity:0'
				+ ';transition:opacity .4s'
			document.body.appendChild( d )
			requestAnimationFrame( () => { d.style.opacity = '1' } )
		} )
		await rec.hold( 2.6 )
		await page.evaluate( () => { const d = document.getElementById( '__ring' ); if ( d ) d.style.opacity = '0' } )
		await rec.hold( .6 )
		//	pull back over the whole diagram to close the segment
		await rec.tween( 2.6, async t => page.evaluate( y => { document.getElementById( 'MAIN_EDITOR' ).scrollTop = y }, 520 * ( 1 - t ) ) )
		await rec.hold( 1.2 )
		await ctx.close()
	}
}

const
capture	= async browser => {
	for	( const seg of SEGMENTS.filter( _ => _.kind === 'shot' ) ) {
		const	langs = PER_LANG.has( seg.id ) ? LANGS : [ null ]
		for ( const lang of langs ) {
			const
			key	= lang ? `${ seg.id }-${ lang }` : seg.id
			,	dir	= fresh( path.join( WORK, 'shots', key ) )
			,	rec	= recorder( dir )
			log( `capture ${ key }` )
			await SHOTS[ seg.id ]( browser, rec, lang )
			//	the natural frame count drives playback rate at assembly time
			saveCount( dir, rec.count )
			console.log( `   ${ rec.count } frames ( ${ ( rec.count / FPS ).toFixed( 1 ) }s of motion )` )
		}
	}
}


//	────────────────────────────────────────────────────────────  main

const
main	= async () => {
	mkdir( WORK )
	mkdir( OUT_DIR )
	if	( !SKIP_CAPTURE ) {
		try {
			sh( 'curl', [ '-sf', '-o', '/dev/null', APP ] )
		} catch {
			throw new Error( `Zukai dev server is not answering on ${ APP } — run: cd Web && npm run dev` )
		}
	}

	log( 'narration' )
	const	tracks = {}
	for	( const lang of LANGS )
		tracks[ lang ] = await narrate( { segments: SEGMENTS, voice: VOICE, lang, work: WORK, root: ROOT } )

	const	browser = await chromium.launch( { headless: true, channel: 'chrome' } )
	try {
		log( 'cards' )
		const	cards = await renderStills( { browser, langs: LANGS, segments: SEGMENTS, cards: CARDS, work: WORK } )
		if	( SKIP_CAPTURE ) log( 'capture skipped ( --skip-capture )' )
		else await capture( browser )
		for	( const lang of LANGS ) {
			log( `assemble ${ lang }` )
			const	{ out, total } = assemble( {
				lang
			,	tracks		: tracks[ lang ]
			,	segments	: SEGMENTS
			,	cards
			,	work		: WORK
			,	outDir		: OUT_DIR
			,	basename	: 'zukai-intro'
			,	shotDir
			} )
			console.log( `   ${ out }  ${ total.toFixed( 1 ) }s` )
		}
	} finally {
		await browser.close()
	}
}

main().catch( er => {
	console.error( er.message || er )
	process.exit( 1 )
} )
