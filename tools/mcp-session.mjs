#!/usr/bin/env node
//	Record a real Claude session driving the Zukai MCP, for tools/make-mcp-video.mjs.
//
//	Keeps a headless browser editor connected to zu-server ( the MCP writes into
//	that live diagram ), runs `claude -p` with the zukai MCP attached, and saves
//	the stream-json event log plus the resulting model.
//
//	Prerequisites:
//	  cd Web && npm run dev          ( zu-server on :8281 )
//	  a logged-in `claude` CLI       ( claude setup-token, or run `claude` once )
//
//	Run:
//	  node tools/mcp-session.mjs --lang ja
//	  node tools/mcp-session.mjs --lang en --out promo/youtube/sessions
//
//	Output: <out>/mcp-session-<lang>.json
//	  { lang, prompts, events: [ … ], model, seconds }

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROMPTS } from './mcp-script.mjs'

const
ROOT	= path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' )
,	PORT	= Number( process.env.ZU_PORT || process.env.PORT ) || 8281
,	APP		= `http://127.0.0.1:${ PORT }/`
,	argv	= process.argv.slice( 2 )
,	argOf	= ( name, fallback ) => {
	const	i = argv.indexOf( name )
	return	i < 0 ? fallback : argv[ i + 1 ]
}
,	LANG	= argOf( '--lang', 'ja' )
,	OUT_DIR	= path.resolve( ROOT, argOf( '--out', 'promo/youtube/sessions' ) )

const
sleep	= ms => new Promise( r => setTimeout( r, ms ) )
,	log	= msg => console.log( `▶ ${ msg }` )

//	one `claude -p` run, streaming its events back as they happen
const
runClaude	= ( prompt, sessionId, onEvent ) => new Promise( ( resolve, reject ) => {
	const
	mcp	= JSON.stringify( {
		mcpServers	: { zukai: { command: 'node', args: [ path.join( ROOT, 'tools', 'zu-mcp.mjs' ) ] } }
	} )
	,	args	= [
		'-p', prompt
	,	'--mcp-config', mcp
	,	'--allowedTools', 'mcp__zukai__zu_status,mcp__zukai__zu_get_model,mcp__zukai__zu_validate,mcp__zukai__zu_apply,mcp__zukai__zu_auto_layout'
		//	keep the session on the MCP: without this it wanders off into the
		//	repo to re-derive the schema, which is 50s of nothing to look at
	,	'--disallowedTools', 'Bash,Read,Write,Edit,Glob,Grep,Task,Agent,ToolSearch,WebFetch,WebSearch,ScheduleWakeup,ListAgents,SendMessage,NotebookEdit'
	,	'--output-format', 'stream-json'
	,	'--verbose'
	,	...( sessionId ? [ '--resume', sessionId ] : [] )
	]
	,	child	= spawn( 'claude', args, { cwd: ROOT, stdio: [ 'ignore', 'pipe', 'pipe' ] } )
	let
	buf	= ''
	,	id	= sessionId
	,	stderr	= ''
	child.stdout.on( 'data', chunk => {
		buf += chunk
		let	nl
		while	( ( nl = buf.indexOf( '\n' ) ) >= 0 ) {
			const	line = buf.slice( 0, nl )
			buf = buf.slice( nl + 1 )
			if	( !line.trim() ) continue
			let	ev
			try { ev = JSON.parse( line ) } catch { continue }
			ev.session_id && ( id = ev.session_id )
			onEvent( ev )
		}
	} )
	child.stderr.on( 'data', d => { stderr += d } )
	child.on( 'close', code => code === 0
		? resolve( id )
		: reject( new Error( `claude exited ${ code }: ${ stderr.slice( -800 ) }` ) )
	)
} )

const
main	= async () => {
	if	( !PROMPTS[ LANG ] )	throw new Error( `no prompts for --lang ${ LANG }` )
	try {
		const	res = await fetch( `${ APP }__zu/status` )
		if	( !res.ok ) throw new Error( String( res.status ) )
	} catch {
		throw new Error( `zu-server is not answering on ${ APP } — run: cd Web && npm run dev` )
	}

	const
	browser	= await chromium.launch( { headless: true, channel: 'chrome' } )
	,	ctx	= await browser.newContext( { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' } )
	await ctx.addInitScript( () => localStorage.removeItem( 'tokyo.828.zukai' ) )
	const	page = await ctx.newPage()
	await page.goto( APP, { waitUntil: 'networkidle' } )
	await page.locator( '#MAIN_EDITOR' ).waitFor( { state: 'attached' } )
	await sleep( 1200 )
	log( `editor connected — ${ await ( await fetch( `${ APP }__zu/status` ) ).text() }` )

	const
	events	= []
	,	t0	= Date.now()
	let	sessionId = null
	try {
		for	( const [ i, prompt ] of PROMPTS[ LANG ].entries() ) {
			log( `prompt ${ i + 1 }/${ PROMPTS[ LANG ].length }: ${ prompt.slice( 0, 60 ) }…` )
			events.push( { at: Date.now() - t0, kind: 'prompt', text: prompt } )
			sessionId = await runClaude( prompt, sessionId, ev => {
				const	at = Date.now() - t0
				for	( const part of ev.message?.content ?? [] ) {
					if	( part.type === 'tool_use' ) {
						events.push( { at, kind: 'tool', name: part.name, input: part.input } )
						console.log( `   [${ ( at / 1000 ).toFixed( 1 ) }s] ${ part.name }` )
					}
					if	( part.type === 'text' && part.text.trim() )
						events.push( { at, kind: 'text', text: part.text.trim() } )
				}
				if	( ev.type === 'result' )
					events.push( { at, kind: 'result', turns: ev.num_turns, cost: ev.total_cost_usd } )
			} )
			const	model = await page.evaluate( () => window.ZU.getModel() )
			log( `   → ${ model.nodes.length } nodes, ${ model.links.length } links` )
		}
		const
		model	= await page.evaluate( () => window.ZU.getModel() )
		,	out	= path.join( OUT_DIR, `mcp-session-${ LANG }.json` )
		fs.mkdirSync( OUT_DIR, { recursive: true } )
		fs.writeFileSync( out, JSON.stringify( {
			lang	: LANG
		,	prompts	: PROMPTS[ LANG ]
		,	events
		,	model
		,	seconds	: ( Date.now() - t0 ) / 1000
		}, null, '\t' ) )
		log( `${ out }  ${ events.length } events, ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) }s` )
	} finally {
		await browser.close()
	}
}

main().catch( er => {
	console.error( er.message || er )
	process.exit( 1 )
} )
