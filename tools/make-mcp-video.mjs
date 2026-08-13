#!/usr/bin/env node
//	Build the "Claude builds a .zu over MCP" video ( Japanese and English ).
//
//	Replays a session recorded by tools/mcp-session.mjs: the chat panel shows the
//	prompts, Claude's replies and its MCP tool calls, and every recorded zu_apply
//	is re-applied to the live diagram shown beside it — so the canvas
//	fills in with exactly the ops Claude sent. Pacing is set here rather than
//	real time, which is why it is a replay and not a screen recording.
//
//	Prerequisites:
//	  cd Web && npm run dev                      ( zu-server on :8281 )
//	  node tools/mcp-session.mjs --lang ja       ( records the session )
//	  node tools/mcp-session.mjs --lang en
//	  ffmpeg, plus the narration engines from tools/intro-script.mjs VOICE
//
//	Run:
//	  node tools/make-mcp-video.mjs
//	  node tools/make-mcp-video.mjs --lang ja
//	  node tools/make-mcp-video.mjs --skip-capture
//
//	Output ( promo/youtube/ ):
//	  zukai-mcp-ja.mp4 / zukai-mcp-en.mp4 + .ja.srt / .en.srt

import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEGMENTS, VOICE, LINK } from './mcp-script.mjs'
import {
	W, H, FPS
,	sleep, log, mkdir, fresh, sh, escapeHtml
,	narrate, renderStills, recorder, saveCount, assemble
} from './video-kit.mjs'

const
ROOT		= path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	OUT_DIR	= path.join( ROOT, 'promo', 'youtube' )
,	SESSIONS	= path.join( OUT_DIR, 'sessions' )
,	WORK	= process.env.ZU_MCP_WORK || path.join( os.tmpdir(), 'zukai-mcp' )
,	PORT	= Number( process.env.ZU_PORT || process.env.PORT ) || 8281
,	APP		= `http://127.0.0.1:${ PORT }/`
,	shotDir	= ( seg, lang ) => path.join( WORK, 'shots', `${ seg.id }-${ lang }` )

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
session	= lang => {
	const	file = path.join( SESSIONS, `mcp-session-${ lang }.json` )
	if	( !fs.existsSync( file ) )
		throw new Error( `no recording for ${ lang } — run: node tools/mcp-session.mjs --lang ${ lang }` )
	return	JSON.parse( fs.readFileSync( file, 'utf8' ) )
}

//	────────────────────────────────────────────────────────────  cards

const
MCP_CONFIG	= `<span class=p>{</span> <span class=k>"mcpServers"</span>: <span class=p>{</span>
    <span class=k>"zukai"</span>: <span class=p>{</span>
      <span class=k>"command"</span>: <span class=s>"node"</span>,
      <span class=k>"args"</span>: <span class=p>[</span> <span class=s>"tools/zu-mcp.mjs"</span> <span class=p>]</span>
    <span class=p>}</span>
<span class=p>} }</span>`

//	the .zu the recorded session actually produced
,	zuSnippet	= lang => {
	const
	{ model }	= session( lang )
	,	node	= n => `      <span class=p>[</span> <span class=s>"${ escapeHtml( n[ 0 ] ) }"</span>, <span class=p>{</span> <span class=k>"type"</span>: <span class=s>"${ n[ 1 ].type }"</span>`
		+ `, <span class=k>"cX"</span>: <span class=n>${ n[ 1 ].cX }</span>, <span class=k>"cY"</span>: <span class=n>${ n[ 1 ].cY }</span> <span class=p>…</span> <span class=p>}</span> <span class=p>]</span>`
	,	link	= l => `      <span class=p>[ [</span> <span class=s>"${ escapeHtml( l[ 0 ][ 0 ] ) }"</span>, <span class=s>"${ escapeHtml( l[ 0 ][ 1 ] ) }"</span> <span class=p>]</span>, <span class=p>{}</span>, <span class=p>{}</span> <span class=p>]</span>`
	return	`<span class=p>{</span> <span class=k>"model"</span>: <span class=p>{</span>
    <span class=k>"nodes"</span>: <span class=p>[</span>
${ model.nodes.slice( 0, 3 ).map( node ).join( ',\n' ) }
      <span class=p>…</span>
    <span class=p>]</span>,
    <span class=k>"links"</span>: <span class=p>[</span>
${ model.links.slice( 0, 2 ).map( link ).join( ',\n' ) }
    <span class=p>]</span>
<span class=p>} }</span>`
}

const
CARDS	= {
	title	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=wrap>
		<div class=word>Zukai</div>
		<div class=tag>${ lang === 'ja' ? '図を描くのは、Claude でもいい。' : 'Let Claude draw the diagram.' }</div>
		<div class=tag2>${ lang === 'ja' ? 'ローカルの MCP サーバー経由で、ブラウザの図を直接編集' : 'A local MCP server, editing the diagram in your browser' }</div>
		<div class=chips>${
			[ 'MCP', '.zu', lang === 'ja' ? 'ローカル実行' : 'Runs locally' ].map( _ => `<span>${ _ }</span>` ).join( '' )
		}</div>
		<div class=url>${ LINK }</div>
	</div>`
,	setup	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=split>
		<div class=code>${ MCP_CONFIG }</div>
		<div class=bullets>
			<div class=kicker>SETUP</div>
			<h2>${ lang === 'ja' ? '2 行で、Claude が<br>あなたの図につながる。' : 'Two lines, and Claude<br>is wired to your diagram.' }</h2>
			<ul>${
				( lang === 'ja'
				?	[ 'cd Web &amp;&amp; npm run dev', 'ブラウザで図を開いておく', 'zu_get_model / zu_apply / zu_validate' ]
				:	[ 'cd Web &amp;&amp; npm run dev', 'Keep the diagram open in a browser', 'zu_get_model / zu_apply / zu_validate' ]
				).map( _ => `<li>${ _ }</li>` ).join( '' )
			}</ul>
		</div>
	</div>`
,	result	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=split>
		<div class=code>${ zuSnippet( lang ) }</div>
		<div class=bullets>
			<div class=kicker>${ lang === 'ja' ? 'できあがり' : 'THE RESULT' }</div>
			<h2>${ lang === 'ja' ? 'AI が書いても、<br>中身はただの JSON。' : 'Written by AI —<br>still just JSON.' }</h2>
			<ul>${
				( lang === 'ja'
				?	[ '続きは手で描いてもいい', 'Git に入れて差分レビュー', 'SVG / PDF に書き出し' ]
				:	[ 'Carry on by hand', 'Commit it and review the diff', 'Export to SVG / PDF' ]
				).map( _ => `<li>${ _ }</li>` ).join( '' )
			}</ul>
		</div>
	</div>`
,	end	: lang => `
	<div class=glow></div><div class=grid></div>
	<div class=wrap>
		<div class=word>Zukai</div>
		<div class=tag>${ lang === 'ja' ? '無料・オープンソース・登録不要' : 'Free · Open source · No sign-up' }</div>
		<div class=tag2>${ lang === 'ja' ? 'MCP の設定は USAGE.md に。' : 'MCP setup lives in USAGE.md.' }</div>
		<div class=url>${ LINK }</div>
	</div>`
}

//	────────────────────────────────────────────────────────────  stage

//	The transcript panel is overlaid on the real editor page rather than sitting
//	next to an iframe: an iframe of the app is a third-party context, and Chrome
//	denies it localStorage, which Zukai writes on every model change. Same page
//	means the replayed ops go straight into window.ZU — the same call the MCP
//	server makes — and the canvas draws them for real.
const
STAGE_CSS	= `
#__side		{ position: fixed; right: 0; top: 0; width: 710px; height: ${ H }px; z-index: 2147483000
			; border-left: 1px solid rgba( 148, 163, 184, .25 ); background: #0b0f18; color: #fff
			; font-family: "Hiragino Sans", "Helvetica Neue", Arial, sans-serif
			; display: flex; flex-direction: column; overflow: hidden }
#__side .head	{ padding: 20px 26px; border-bottom: 1px solid rgba( 148, 163, 184, .2 )
			; display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700 }
#__side .dot	{ width: 10px; height: 10px; border-radius: 50%; background: #34d399
			; box-shadow: 0 0 12px #34d399 }
#__side .head small	{ margin-left: auto; font-size: 14px; font-weight: 500; color: #8fa0b8
			; font-family: "SF Mono", Menlo, monospace }
#__side .log	{ flex: 1; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px
			; justify-content: flex-end; overflow: hidden }
#__side .msg	{ border-radius: 14px; padding: 14px 18px; font-size: 20px; line-height: 1.55
			; animation: in .28s ease-out }
@keyframes in { from { opacity: 0; transform: translateY( 10px ) } to { opacity: 1 } }
#__side .who	{ font-size: 12px; letter-spacing: .2em; color: #93a3ba; margin-bottom: 7px }
#__side .user	{ background: rgba( 124, 58, 237, .2 ); border: 1px solid rgba( 167, 139, 250, .5 ) }
#__side .claude	{ background: #111827; border: 1px solid rgba( 148, 163, 184, .22 ); color: #d7e0ee }
#__side .tool	{ background: #0e1320; border: 1px solid rgba( 52, 211, 153, .35 )
			; font-family: "SF Mono", Menlo, monospace; font-size: 15px; line-height: 1.5
			; color: #9fb3c8; white-space: pre-wrap; word-break: break-all }
#__side .tool b	{ color: #6ee7b7; font-size: 17px }
#__side .ok	{ color: #6ee7b7 }
`

//	injected into the editor page: builds the panel and the add() the replay uses
,	STAGE_JS	= css => {
	const
	style	= document.createElement( 'style' )
	style.textContent = css
	document.head.appendChild( style )
	const
	side	= document.createElement( 'div' )
	side.id = '__side'
	side.innerHTML = '<div class=head><span class=dot></span>Claude<small>zukai MCP</small></div><div class=log id=__log></div>'
	document.body.appendChild( side )
	window.__stage = {
		add	: ( cls, who, html ) => {
			const
			log	= document.getElementById( '__log' )
			,	d	= document.createElement( 'div' )
			d.className = 'msg ' + cls
			d.innerHTML = ( who ? '<div class=who>' + who + '</div>' : '' ) + html
			log.appendChild( d )
			//	the panel is bottom-aligned, so old messages fall off the top
			while ( log.scrollHeight > log.clientHeight && log.children.length > 1 )
				log.removeChild( log.firstChild )
		}
	}
}

const
short	= ( text, max ) => {
	const	one = text.replace( /\s+/g, ' ' ).trim()
	return	escapeHtml( one.length > max ? `${ one.slice( 0, max ) }…` : one )
}

//	tool calls are shown as the agent sent them, just clipped to fit the panel
,	toolCard	= ev => {
	const
	name	= ev.name.replace( /^mcp__zukai__/, '' )
	,	input	= JSON.stringify( ev.input ?? {}, null, 1 ).replace( /\n\s*/g, ' ' )
	return	`<b>${ escapeHtml( name ) }</b> ${ short( input, 190 ) }`
}

,	replay	= async ( { rec, page, events, lang } ) => {
	const
	add	= ( cls, who, html ) => page.evaluate( ( [ cls, who, html ] ) => window.__stage.add( cls, who, html ), [ cls, who, html ] )
	,	WHO	= lang === 'ja' ? { user: 'あなた', claude: 'CLAUDE' } : { user: 'YOU', claude: 'CLAUDE' }
	for	( const ev of events ) {
		switch ( ev.kind ) {
		case 'prompt':
			await add( 'user', WHO.user, short( ev.text, 150 ) )
			await rec.hold( 2 )
			break
		case 'text':
			await add( 'claude', WHO.claude, short( ev.text, 130 ) )
			await rec.hold( Math.min( 2.2, 1 + ev.text.length / 90 ) )
			break
		case 'tool': {
			await add( 'tool', null, toolCard( ev ) )
			await rec.hold( .9 )
			//	re-apply exactly what the agent sent, into the live editor
			if	( ev.name.endsWith( 'zu_apply' ) && Array.isArray( ev.input?.ops ) ) {
				await page.evaluate( ops => window.ZU.apply( ops ), ev.input.ops )
				//	drop the selection the apply leaves behind — the handles are
				//	editor state, not part of the diagram
				await page.evaluate( () => { window.app.reforms = []; window.ZU.draw() } )
				await rec.hold( 1.6 )
			}
			break
		}
		default:
			break
		}
	}
}

//	────────────────────────────────────────────────────────────  capture

const
capture	= async ( browser, lang ) => {
	const
	{ events }	= session( lang )
	,	byPrompt	= []
	for	( const ev of events ) {
		( ev.kind === 'prompt' || !byPrompt.length ) && byPrompt.push( [] )
		byPrompt[ byPrompt.length - 1 ].push( ev )
	}
	if	( byPrompt.length < 2 )
		throw new Error( `recording for ${ lang } has ${ byPrompt.length } prompt( s ), expected 2` )

	const
	ctx	= await browser.newContext( { viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' } )
	await ctx.addInitScript( () => {
		localStorage.removeItem( 'tokyo.828.zukai' )
		localStorage.setItem( 'nav-collapsed', '1' )
		localStorage.setItem( 'aside-collapsed', '1' )
	} )
	const	page = await ctx.newPage()
	await page.goto( APP, { waitUntil: 'networkidle' } )
	await page.locator( '#MAIN_EDITOR' ).waitFor( { state: 'attached' } )
	await page.evaluate( STAGE_JS, STAGE_CSS )
	await sleep( 800 )
	await page.evaluate( () => window.ZU.setModel( { nodes: [], links: [] } ) )

	//	one shot per prompt: 'build' then 'refine'
	for	( const [ i, id ] of [ 'build', 'refine' ].entries() ) {
		const
		dir	= fresh( path.join( WORK, 'shots', `${ id }-${ lang }` ) )
		,	rec	= recorder( dir )
		rec.page = page
		log( `capture ${ id }-${ lang }` )
		await rec.hold( .6 )
		await replay( { rec, page, events: byPrompt[ i ], lang } )
		await rec.hold( 1.4 )
		saveCount( dir, rec.count )
		console.log( `   ${ rec.count } frames ( ${ ( rec.count / FPS ).toFixed( 1 ) }s )` )
	}
	await ctx.close()
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
	for	( const lang of LANGS )	session( lang )		//	fail early if a recording is missing

	log( 'narration' )
	const	tracks = {}
	for	( const lang of LANGS )
		tracks[ lang ] = await narrate( { segments: SEGMENTS, voice: VOICE, lang, work: WORK, root: ROOT } )

	const	browser = await chromium.launch( { headless: true, channel: 'chrome' } )
	try {
		log( 'cards' )
		const	cards = await renderStills( { browser, langs: LANGS, segments: SEGMENTS, cards: CARDS, work: WORK } )
		for	( const lang of LANGS ) {
			if	( SKIP_CAPTURE ) log( `capture skipped ( ${ lang } )` )
			else await capture( browser, lang )
			log( `assemble ${ lang }` )
			const	{ out, total } = assemble( {
				lang
			,	tracks		: tracks[ lang ]
			,	segments	: SEGMENTS
			,	cards
			,	work		: WORK
			,	outDir		: OUT_DIR
			,	basename	: 'zukai-mcp'
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
