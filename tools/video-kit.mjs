//	Shared machinery for the promo videos ( tools/make-intro-video.mjs,
//	tools/make-mcp-video.mjs ): narration, title cards, frame recording and the
//	ffmpeg assembly.
//
//	A movie is a list of segments — 'card' segments are stills with a slow
//	push-in, 'shot' segments are captured frame sequences whose playback rate is
//	stretched to fit the narration. Each movie script owns its own SEGMENTS,
//	CARDS and capture code and calls into here for the rest.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const
W		= 1920
,	H		= 1080
,	FPS		= 15				//	capture rate
,	OUT_FPS	= 30
,	BG		= '#080b12'
,	ACCENT	= '#a78bfa'

export const
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
,	escapeHtml	= _ => String( _ ).replace( /[&<>]/g, c => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;' } )[ c ] )

//	────────────────────────────────────────────────────────────  narration

const
VOICEVOX	= process.env.VOICEVOX_URL || 'http://127.0.0.1:50021'

//	VOICEVOX ENGINE: text → accent query → wav. The lead / tail silence is added
//	by narrate(), so the engine's own padding is zeroed out here.
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

//	GPT-SoVITS has no HTTP API here, so a whole language is rendered in one
//	python run — loading the models per line would cost minutes.
,	voiceger	= ( items, cfg, work, root ) => {
	const
	base	= process.env.VOICEGER_ROOT || cfg.root
	,	python	= process.env.VOICEGER_PYTHON || cfg.python
	,	at	= _ => path.isAbsolute( _ ) ? _ : path.join( base, _ )
	if	( !fs.existsSync( python ) )	throw new Error( `voiceger python not found: ${ python } — set VOICEGER_PYTHON` )
	const
	job	= path.join( work, 'audio', 'voiceger-job.json' )
	fs.writeFileSync( job, JSON.stringify( {
		root		: base
	,	gpt			: at( cfg.gpt )
	,	sovits		: at( cfg.sovits )
	,	ref_audio	: at( cfg.refAudio )
	,	ref_text	: cfg.refText
	,	ref_lang	: cfg.refLang ?? 'Japanese'
	,	lang		: cfg.lang ?? 'English'
	,	items
	}, null, '\t' ) )
	sh( python, [ path.join( root, 'tools', 'voiceger-tts.py' ), job ] )
}

,	speak	= async ( text, cfg, out ) => cfg.engine === 'voicevox'
?	voicevox( text, cfg, out )
:	sh( 'say', [ '-v', cfg.voice, '-r', String( cfg.rate ), '--file-format=WAVE', '--data-format=LEI16@44100', '-o', out, text ] )

//	one padded wav per segment: lead silence + speech + tail, loudness-matched
export const
narrate	= async ( { segments, voice, lang, work, root } ) => {
	const
	dir	= mkdir( path.join( work, 'audio' ) )
	,	cfg	= voice[ lang ]
	,	raws	= segments.map( seg => path.join( dir, `${ lang }-${ seg.id }-raw.wav` ) )
	,	out	= []
	cfg.engine === 'voiceger'
	&&	voiceger( segments.map( ( seg, i ) => ( { text: seg.narration[ lang ], out: raws[ i ] } ) ), cfg, work, root )
	for	( const [ i, seg ] of segments.entries() ) {
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

export const
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

//	one png per card segment, plus a transparent lower-third per captioned shot
export const
renderStills	= async ( { browser, langs, segments, cards, work, css = '' } ) => {
	const
	dir	= mkdir( path.join( work, 'cards' ) )
	,	page	= await browser.newPage( { viewport: { width: W, height: H }, deviceScaleFactor: 1 } )
	for	( const lang of langs ) {
		for ( const seg of segments.filter( _ => _.kind === 'card' ) ) {
			await page.setContent( `<style>${ CSS }${ css }</style>${ cards[ seg.card ]( lang ) }` )
			await page.screenshot( { path: path.join( dir, `card-${ lang }-${ seg.id }.png` ) } )
		}
		for ( const seg of segments.filter( _ => _.kind === 'shot' && _.caption ) ) {
			await page.setContent( `<style>${ CSS }body{background:transparent}</style><div class=cap><i></i><span>${ seg.caption[ lang ] }</span></div>` )
			await page.screenshot( { path: path.join( dir, `cap-${ lang }-${ seg.id }.png` ), omitBackground: true } )
		}
	}
	await page.close()
	return	dir
}

//	────────────────────────────────────────────────────────────  frames

//	Screenshots into a numbered jpeg sequence. `page` is set by the capture code
//	once it has one; the natural frame count decides playback rate at assembly.
export const
recorder	= dir => {
	let	n = 0
	const
	rec	= {
		page	: null
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

export const
saveCount	= ( dir, count ) => fs.writeFileSync( path.join( dir, 'count.txt' ), String( count ) )

//	────────────────────────────────────────────────────────────  assembly

const
padFrames	= ( dir, need ) => {
	const	files = fs.readdirSync( dir ).filter( _ => _.endsWith( '.jpg' ) ).sort()
	if	( !files.length ) throw new Error( `no frames in ${ dir }` )
	const	last = path.join( dir, files[ files.length - 1 ] )
	for	( let i = files.length; i < need; i++ )
		fs.copyFileSync( last, path.join( dir, `f-${ String( i ).padStart( 5, '0' ) }.jpg` ) )
}

,	encodeSegment = ( { seg, lang, dur, cards, dir, shotDir } ) => {
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
	shot	= Number( fs.readFileSync( path.join( shotDir, 'count.txt' ), 'utf8' ) )
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

//	one cue per sentence, time split by character count
,	cues	= ( sub, segments, tracks ) => {
	const	out = []
	let		clock = 0
	segments.forEach( ( seg, i ) => {
		const
		t		= tracks[ i ]
		,	text	= ( seg.subtitle?.[ sub ] ?? seg.narration[ sub ] )
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

//	segments → mp4 + .srt in both languages
export const
assemble	= ( { lang, tracks, segments, cards, work, outDir, basename, shotDir } ) => {
	const
	dir		= fresh( path.join( work, 'segs', lang ) )
	,	parts	= segments.map( ( seg, i ) => encodeSegment( {
		seg
	,	lang
	,	dur		: tracks[ i ].total
	,	cards
	,	dir
	,	shotDir	: seg.kind === 'shot' ? shotDir( seg, lang ) : null
	} ) )
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
	,	out	= path.join( mkdir( outDir ), `${ basename }-${ lang }.mp4` )
	ffmpeg( [
		'-i', silent, '-i', audio
	,	'-vf', `fade=t=in:st=0:d=0.6,fade=t=out:st=${ ( total - .8 ).toFixed( 2 ) }:d=0.8`
	,	'-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${ ( total - .6 ).toFixed( 2 ) }:d=0.6`
	,	'-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p'
	,	'-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'
	,	'-shortest', out
	] )
	for	( const sub of [ 'ja', 'en' ] )
		fs.writeFileSync( path.join( outDir, `${ basename }-${ lang }.${ sub }.srt` ), cues( sub, segments, tracks ) )
	return	{ out, total }
}
