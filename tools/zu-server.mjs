#!/usr/bin/env node
//	Zukai dev server: static Web/ + Samples live-reload + model RPC bridge.
//
//	Browser ( window.ZU ) ↔ WebSocket ↔ this server ↔ HTTP ↔ zu-mcp.mjs
//
//	Usage:
//	  node tools/zu-server.mjs
//	  open http://localhost:8281/?zu=Samples/JSONs.zu

import path from 'node:path'
import { createDevServer } from '../Web/SAT/DevServer.mjs'
import { ROOT, WEB, PORT } from './zu-paths.mjs'

const
HOST	= process.env.ZU_HOST || '127.0.0.1'

createDevServer( {
	name			: 'zu-server'
,	root			: ROOT
,	web				: WEB
,	port			: PORT
,	host			: HOST
,	apiPrefix		: '/__zu'
,	mime			: { '.zu': 'application/json; charset=utf-8' }
,	watch			: [ {
		dir		: path.join( WEB, 'Samples' )
	,	match	: name => name.endsWith( '.zu' )
	} ]
,	changeType		: 'zu-changed'
,	snapshotTypes	: [ 'editor-ready', 'model-update' ]
,	applySnapshot	: ( msg, prev ) => ( {
		model		: msg.model
	,	canvas		: msg.canvas
	,	watchPath	: msg.watchPath ?? prev?.watchPath ?? null
	} )
,	logSnapshot		: snap => `${ snap.model?.nodes?.length ?? 0 } nodes`
,	statusOf		: ( snap, connected ) => ( {
		connected
	,	watchPath	: snap?.watchPath ?? null
	,	nodeCount	: snap?.model?.nodes?.length ?? 0
	,	linkCount	: snap?.model?.links?.length ?? 0
	,	canvas		: snap?.canvas ?? null
	} )
,	documentRoute	: 'model'
,	getDocument		: 'getModel'
,	noDocumentError	: 'No editor connected and no cached model.'
,	noEditorError	: 'No browser editor connected. Open npm run dev and load a diagram.'
,	noStore			: ext => ext === '.zu'
,	examplePath		: '?zu=Samples/JSONs.zu'
,	portEnvHint		: 'ZU_PORT=8280 node tools/zu-server.mjs'
} )
