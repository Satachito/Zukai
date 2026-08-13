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
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEGMENTS, VOICE, LINK } from './intro-script.mjs'

const
ROOT		= path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	OUT_DIR	= path.join( ROOT, 'promo', 'youtube' )
,	WORK	= process.env.ZU_INTRO_WORK || path.join( os.tmpdir(), 'zukai-intro' )
,	PORT	= Number( process.env.ZU_PORT || process.env.PORT ) || 8281
,	APP		= `http://127.0.0.1:${ PORT }/`
,	W		= 1920
,	H		= 1080
,	FPS		= 15				//	capture rate
,	OUT_FPS	= 30
,	BG		= '#080b12'
,	ACCENT	= '#a78bfa'
,	PER_LANG	= new Set( [ 'ai' ] )	//	shots whose footage differs per language

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

const
sleep	= ms => new Promise( r => setTimeout( r, ms ) )
,	log	= msg => console.log( `▶ ${ msg }` )
,	mkdir	= dir => ( fs.mkdirSync( dir, { recursive: true } ), dir )
,	fresh	= dir => ( fs.rmSync( dir, { recursive: true, force: true } ), mkdir( dir ) )
,	sh	= ( cmd, args ) => {
	try {
		return	execFileSync( cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: [ 'ignore', 'pipe', 'pipe' ] } )
	} catch ( er ) {
		throw new Error( `${ cmd } failed: ${ ( er.stderr || er.message ).toString().slice( -1500 ) }` )
	}
}
,	ffmpeg	= args => sh( 'ffmpeg', [ '-hide_banner', '-loglevel', 'error', '-y', ...args ] )
,	seconds	= file => Number( sh( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file ] ).trim() )
,	ease	= t => t < .5 ? 2 * t * t : 1 - ( -2 * t + 2 ) ** 2 / 2

//	────────────────────────────────────────────────────────────  narration

const
VOICEVOX	= process.env.VOICEVOX_URL || 'http://127.0.0.1:50021'

//	VOICEVOX ENGINE: text → accent query → wav. The lead / tail silence is added
//	below, so the engine's own padding is zeroed out here.
,	voicevox	= async ( text, cfg, out ) => {
	const
	speaker	= cfg.speaker ?? 3
	,	ask	= await fetch( `${ VOICEVOX }/audio_query?speaker=${ speaker }&text=${ encodeURIComponent( text ) }`, { method: 'POST' } )
		.catch( er => { throw new Error( `VOICEVOX unreachable at ${ VOICEVOX } ( ${ er.message } ) — start VOICEVOX, or set VOICEVOX_URL` ) } )
	if	( !ask.ok )	throw new Error( `VOICEVOX audio_query failed: ${ ask.status } ${ await ask.text() }` )
	const
	query	= await ask.json()
	query.speedScale		= cfg.speed ?? 1
	query.pitchScale		= cfg.pitch ?? 0
	query.intonationScale	= cfg.intonation ?? 1
	query.prePhonemeLength	= 0
	query.postPhonemeLength	= 0
	const
	wav	= await fetch( `${ VOICEVOX }/synthesis?speaker=${ speaker }`, {
		method	: 'POST'
	,	headers	: { 'content-type': 'application/json' }
	,	body	: JSON.stringify( query )
	} )
	if	( !wav.ok )	throw new Error( `VOICEVOX synthesis failed: ${ wav.status } ${ await wav.text() }` )
	fs.writeFileSync( out, Buffer.from( await wav.arrayBuffer() ) )
}

//	GPT-SoVITS has no HTTP API here, so the whole language is rendered in one
//	python run — loading the models per line would cost minutes.
,	voiceger	= ( items, cfg ) => {
	const
	root	= process.env.VOICEGER_ROOT || cfg.root
	,	python	= process.env.VOICEGER_PYTHON || cfg.python
	,	at	= _ => path.isAbsolute( _ ) ? _ : path.join( root, _ )
	if	( !fs.existsSync( python ) )	throw new Error( `voiceger python not found: ${ python } — set VOICEGER_PYTHON` )
	const
	job	= path.join( WORK, 'audio', 'voiceger-job.json' )
	fs.writeFileSync( job, JSON.stringify( {
		root
	,	gpt			: at( cfg.gpt )
	,	sovits		: at( cfg.sovits )
	,	ref_audio	: at( cfg.refAudio )
	,	ref_text	: cfg.refText
	,	ref_lang	: cfg.refLang ?? 'Japanese'
	,	lang		: cfg.lang ?? 'English'
	,	items
	}, null, '\t' ) )
	sh( python, [ path.join( ROOT, 'tools', 'voiceger-tts.py' ), job ] )
}

,	speak	= async ( text, cfg, out ) => cfg.engine === 'voicevox'
?	voicevox( text, cfg, out )
:	sh( 'say', [ '-v', cfg.voice, '-r', String( cfg.rate ), '--file-format=WAVE', '--data-format=LEI16@44100', '-o', out, text ] )

,	narrate	= async lang => {
	const
	dir	= mkdir( path.join( WORK, 'audio' ) )
	,	cfg	= VOICE[ lang ]
	,	raws	= SEGMENTS.map( seg => path.join( dir, `${ lang }-${ seg.id }-raw.wav` ) )
	,	out	= []
	cfg.engine === 'voiceger'
	&&	voiceger( SEGMENTS.map( ( seg, i ) => ( { text: seg.narration[ lang ], out: raws[ i ] } ) ), cfg )
	for	( const [ i, seg ] of SEGMENTS.entries() ) {
		const
		raw	= raws[ i ]
		cfg.engine === 'voiceger' || await speak( seg.narration[ lang ], cfg, raw )
		const
		speech	= seconds( raw )
		,	lead	= seg.lead ?? .45
		,	tail	= seg.tail ?? .8
		,	total	= Math.round( ( lead + speech + tail ) * 1000 ) / 1000
		,	padded	= path.join( dir, `${ lang }-${ seg.id }.wav` )
		ffmpeg( [
			'-i', raw
			//	loudnorm first, so VOICEVOX and voiceger land at the same level
		,	'-af', `loudnorm=I=-16:TP=-1.5:LRA=11,adelay=${ Math.round( lead * 1000 ) }:all=1,apad`
		,	'-t', String( total )
		,	'-ar', '48000', '-ac', '2'
		,	padded
		] )
		out.push( { id: seg.id, lead, speech, total, wav: padded } )
	}
	return	out
}

//	────────────────────────────────────────────────────────────  cards

const
CSS	= `
*			{ margin: 0; padding: 0; box-sizing: border-box }
body		{ width: ${ W }px; height: ${ H }px; background: ${ BG }; color: #fff; overflow: hidden
			; font-family: "Hiragino Sans", "Helvetica Neue", Arial, sans-serif
			; -webkit-font-smoothing: antialiased }
.glow		{ position: absolute; inset: 0
			; background:
				radial-gradient( 900px 520px at 22% 18%, rgba( 124, 58, 237, .30 ), transparent 70% )
			,	radial-gradient( 820px 520px at 82% 88%, rgba( 34, 211, 238, .18 ), transparent 70% ) }
.grid		{ position: absolute; inset: 0; opacity: .16
			; background-image:
				linear-gradient( rgba( 148, 163, 184, .18 ) 1px, transparent 1px )
			,	linear-gradient( 90deg, rgba( 148, 163, 184, .18 ) 1px, transparent 1px )
			; background-size: 64px 64px
			; mask-image: radial-gradient( 70% 60% at 50% 50%, #000 40%, transparent 100% ) }
.wrap		{ position: relative; height: 100%; display: flex; flex-direction: column
			; align-items: center; justify-content: center; gap: 26px; text-align: center }
.word		{ font-family: fantasy; font-size: 108px; line-height: 1; letter-spacing: .01em }
.tag		{ font-size: 46px; font-weight: 700; letter-spacing: .01em }
.tag2		{ font-size: 27px; color: #9db0cc; font-weight: 500 }
.chips		{ display: flex; gap: 14px; margin-top: 6px }
.chips span	{ border: 1px solid rgba( 167, 139, 250, .5 ); border-radius: 999px
			; padding: 9px 20px; font-size: 21px; color: #ddd6fe
			; background: rgba( 124, 58, 237, .13 ) }
.url		{ font-family: "SF Mono", Menlo, monospace; font-size: 30px; color: #fff
			; border-top: 1px solid rgba( 148, 163, 184, .28 ); padding-top: 22px; margin-top: 10px }
.kicker		{ font-size: 22px; letter-spacing: .32em; color: ${ ACCENT }; font-weight: 700 }
.split		{ position: relative; height: 100%; display: grid; grid-template-columns: 1fr 1fr
			; align-items: center; gap: 64px; padding: 0 96px }
.code		{ background: #0e1320; border: 1px solid rgba( 148, 163, 184, .28 ); border-radius: 18px
			; padding: 30px 34px; font-family: "SF Mono", Menlo, monospace; font-size: 23px
			; line-height: 1.65; white-space: pre; color: #cbd5e1; box-shadow: 0 24px 60px rgba( 0, 0, 0, .5 ) }
.k			{ color: #7dd3fc }
.s			{ color: #a7f3d0 }
.n			{ color: ${ ACCENT } }
.p			{ color: #64748b }
.bullets	{ display: flex; flex-direction: column; gap: 26px; text-align: left }
.bullets h2	{ font-size: 40px; line-height: 1.3 }
.bullets li	{ list-style: none; font-size: 25px; color: #c4d0e3; line-height: 1.5
			; padding-left: 34px; position: relative }
.bullets li::before { content: "▸"; position: absolute; left: 0; color: ${ ACCENT } }
.cap		{ position: absolute; left: 64px; bottom: 68px; display: inline-flex; align-items: center
			; gap: 16px; padding: 20px 34px; border-radius: 16px
			; background: rgba( 8, 11, 18, .82 ); border: 1px solid rgba( 167, 139, 250, .45 )
			; backdrop-filter: blur( 6px ); box-shadow: 0 18px 44px rgba( 0, 0, 0, .55 ) }
.cap i		{ width: 10px; height: 34px; border-radius: 4px; background: ${ ACCENT }; display: block }
.cap span	{ font-size: 32px; font-weight: 700; color: #fff }
`

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

const
renderStills	= async ( browser, langs ) => {
	const
	dir	= mkdir( path.join( WORK, 'cards' ) )
	,	page	= await browser.newPage( { viewport: { width: W, height: H }, deviceScaleFactor: 1 } )
	for	( const lang of langs ) {
		for ( const seg of SEGMENTS.filter( _ => _.kind === 'card' ) ) {
			await page.setContent( `<style>${ CSS }</style>${ CARDS[ seg.card ]( lang ) }` )
			await page.screenshot( { path: path.join( dir, `card-${ lang }-${ seg.id }.png` ) } )
		}
		for ( const seg of SEGMENTS.filter( _ => _.kind === 'shot' && _.caption ) ) {
			await page.setContent( `<style>${ CSS }body{background:transparent}</style><div class=cap><i></i><span>${ seg.caption[ lang ] }</span></div>` )
			await page.screenshot( { path: path.join( dir, `cap-${ lang }-${ seg.id }.png` ), omitBackground: true } )
		}
	}
	await page.close()
	return	dir
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
recorder	= dir => {
	let	n = 0
	const
	rec	= {
		page	: null				//	set by newPage()
	,	get count() { return n }
	,	grab	: async () => rec.page.screenshot( { path: path.join( dir, `f-${ String( n++ ).padStart( 5, '0' ) }.jpg` ), type: 'jpeg', quality: 92 } )
	,	hold	: async sec => { for ( let i = 0; i < Math.round( sec * FPS ); i++ ) await rec.grab() }
	,	tween	: async ( sec, fn ) => {
			const	steps = Math.max( 1, Math.round( sec * FPS ) )
			for ( let i = 1; i <= steps; i++ ) { await fn( ease( i / steps ), i / steps ); await rec.grab() }
		}
	}
	return	rec
}

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
			fs.writeFileSync( path.join( dir, 'count.txt' ), String( rec.count ) )
			console.log( `   ${ rec.count } frames ( ${ ( rec.count / FPS ).toFixed( 1 ) }s of motion )` )
		}
	}
}

//	────────────────────────────────────────────────────────────  assembly

const
padFrames	= ( dir, need ) => {
	const	files = fs.readdirSync( dir ).filter( _ => _.endsWith( '.jpg' ) ).sort()
	if	( !files.length ) throw new Error( `no frames in ${ dir }` )
	const	last = path.join( dir, files[ files.length - 1 ] )
	for	( let i = files.length; i < need; i++ )
		fs.copyFileSync( last, path.join( dir, `f-${ String( i ).padStart( 5, '0' ) }.jpg` ) )
	return	need
}

,	encodeSegment	= ( seg, lang, dur, cards, dir ) => {
	const
	out	= path.join( dir, `${ lang }-${ seg.id }.mp4` )
	,	tail	= [
		'-c:v', 'libx264', '-preset', 'medium', '-crf', '19'
	,	'-pix_fmt', 'yuv420p', '-r', String( OUT_FPS ), '-an', out
	]
	if	( seg.kind === 'card' ) {
		const	still = path.join( cards, `card-${ lang }-${ seg.id }.png` )
		//	slow push-in keeps a static card alive
		ffmpeg( [
			'-loop', '1', '-framerate', String( OUT_FPS ), '-t', String( dur ), '-i', still
		,	'-vf', `zoompan=z='min(1+0.00028*on,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${ W }x${ H }:fps=${ OUT_FPS },format=yuv420p`
		,	...tail
		] )
		return	out
	}
	//	stretch or compress the captured motion so it fills the narration exactly
	const
	shotDir	= path.join( WORK, 'shots', PER_LANG.has( seg.id ) ? `${ seg.id }-${ lang }` : seg.id )
	,	shot	= Number( fs.readFileSync( path.join( shotDir, 'count.txt' ), 'utf8' ) )
	,	rate	= Math.min( FPS * 1.8, Math.max( FPS * .7, shot / dur ) )
	padFrames( shotDir, Math.ceil( dur * rate ) + 2 )
	const
	capPng	= path.join( cards, `cap-${ lang }-${ seg.id }.png` )
	,	hasCap	= seg.caption && fs.existsSync( capPng )
	,	fadeOut	= Math.max( .2, dur - .9 )
	ffmpeg( hasCap
	?	[
			'-framerate', rate.toFixed( 3 ), '-i', path.join( shotDir, 'f-%05d.jpg' )
		,	'-loop', '1', '-framerate', String( OUT_FPS ), '-t', String( dur ), '-i', capPng
		,	'-filter_complex'
		,	`[0:v]scale=${ W }:${ H },fps=${ OUT_FPS }[bg];`
			+ `[1:v]format=rgba,fade=t=in:st=0.35:d=0.45:alpha=1,fade=t=out:st=${ fadeOut.toFixed( 2 ) }:d=0.5:alpha=1[cap];`
			+ `[bg][cap]overlay=0:0:format=auto,format=yuv420p[v]`
		,	'-map', '[v]', '-t', String( dur ), ...tail
		]
	:	[
			'-framerate', rate.toFixed( 3 ), '-i', path.join( shotDir, 'f-%05d.jpg' )
		,	'-vf', `scale=${ W }:${ H },fps=${ OUT_FPS },format=yuv420p`
		,	'-t', String( dur ), ...tail
		]
	)
	return	out
}

,	srtTime	= t => {
	const
	ms	= Math.round( t * 1000 )
	,	pad	= ( n, w = 2 ) => String( n ).padStart( w, '0' )
	return	`${ pad( Math.floor( ms / 3600000 ) ) }:${ pad( Math.floor( ms / 60000 ) % 60 ) }:${ pad( Math.floor( ms / 1000 ) % 60 ) },${ pad( ms % 1000, 3 ) }`
}

,	cues	= ( lang, tracks ) => {
	//	one cue per sentence, time split by character count
	const	out = []
	let		clock = 0
	SEGMENTS.forEach( ( seg, i ) => {
		const
		t		= tracks[ i ]
		,	text	= ( seg.subtitle?.[ lang ] ?? seg.narration[ lang ] )
		,	parts	= text.split( /(?<=[。．.!?！？])\s*/ ).map( _ => _.trim() ).filter( Boolean )
		,	chars	= parts.reduce( ( a, b ) => a + b.length, 0 ) || 1
		let	at = clock + t.lead
		for ( const part of parts ) {
			const	d = t.speech * part.length / chars
			out.push( { start: at, end: at + d, text: part } )
			at += d
		}
		clock += t.total
	} )
	return	out.map( ( c, i ) => `${ i + 1 }\n${ srtTime( c.start ) } --> ${ srtTime( c.end ) }\n${ c.text }\n` ).join( '\n' )
}

,	build	= ( lang, tracks, cards ) => {
	const
	dir		= fresh( path.join( WORK, 'segs', lang ) )
	,	parts	= SEGMENTS.map( ( seg, i ) => encodeSegment( seg, lang, tracks[ i ].total, cards, dir ) )
	,	vList	= path.join( dir, 'video.txt' )
	,	aList	= path.join( dir, 'audio.txt' )
	fs.writeFileSync( vList, parts.map( _ => `file '${ _ }'` ).join( '\n' ) )
	fs.writeFileSync( aList, tracks.map( _ => `file '${ _.wav }'` ).join( '\n' ) )
	const
	silent	= path.join( dir, 'video.mp4' )
	,	audio	= path.join( dir, 'audio.wav' )
	ffmpeg( [ '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', silent ] )
	ffmpeg( [ '-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', audio ] )
	const
	total	= tracks.reduce( ( a, b ) => a + b.total, 0 )
	,	out	= path.join( OUT_DIR, `zukai-intro-${ lang }.mp4` )
	ffmpeg( [
		'-i', silent, '-i', audio
	,	'-vf', `fade=t=in:st=0:d=0.6,fade=t=out:st=${ ( total - .8 ).toFixed( 2 ) }:d=0.8`
	,	'-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${ ( total - .6 ).toFixed( 2 ) }:d=0.6`
	,	'-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p'
	,	'-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'
	,	'-shortest', out
	] )
	for	( const sub of [ 'ja', 'en' ] )
		fs.writeFileSync( path.join( OUT_DIR, `zukai-intro-${ lang }.${ sub }.srt` ), cues( sub, tracks ) )
	return	{ out, total }
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
	for	( const lang of LANGS )	tracks[ lang ] = await narrate( lang )

	const	browser = await chromium.launch( { headless: true, channel: 'chrome' } )
	try {
		log( 'cards' )
		const	cards = await renderStills( browser, LANGS )
		if	( SKIP_CAPTURE ) log( 'capture skipped ( --skip-capture )' )
		else await capture( browser )
		for	( const lang of LANGS ) {
			log( `assemble ${ lang }` )
			const	{ out, total } = build( lang, tracks[ lang ], cards )
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
