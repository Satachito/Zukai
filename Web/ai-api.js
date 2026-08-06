//	AI-facing command surface for the live, in-browser model.
//
//	Everything here mutates window.app through Application.js. A single apply()
//	batch is one undo step and rolls back entirely on any op failure. Exposed as
//	window.ZU so an external agent ( browser CDP, WebSocket bridge, MCP ) can
//	read, validate, generate and lay out the diagram directly.

import {
	FindNode
,	Node
,	EditNode
,	RemoveNode
,	Restack
,	Link
,	EditLink
,	RemoveLink
,	SetModel
,	DoTypical
,	withoutHistory
}	from './Application.js'

import {
	CanvasSize
,	SetCanvasSize
}	from './main-editor.js'

import {
	updateNodeArgs
,	updateLinkArgs
}	from './update-args.js'

const
isNum			= v => typeof v === 'number' && Number.isFinite( v )

const
CORNER_STYLES	= new Set( [ 'sharp', 'arc', 'curve' ] )

const
validateNode	= ( n, ids, issues, i ) => {
	if	( !Array.isArray( n ) || n.length < 2 ) {
		issues.push( `node[${ i }] must be [ ID, area, paint? ]` )
		return
	}
	const	[ ID, S ] = n
	if	( !ID || typeof ID !== 'string' )	issues.push( `node[${ i }] has an empty / non-string ID` )
	else if	( ids.has( ID ) )				issues.push( `duplicate node ID "${ ID }"` )
	else									ids.add( ID )
	if	( !S || typeof S !== 'object' ) {
		issues.push( `node "${ ID }" is missing its area object` )
		return
	}
	if	( !S.type )	issues.push( `node "${ ID }" is missing "type"` )
	for	( const k of [ 'cX', 'cY', 'rH', 'rV' ] )
		if	( !isNum( S[ k ] ) )	issues.push( `node "${ ID }" ${ k } must be a number` )
	if	( isNum( S.rH ) && isNum( S.rV ) && !( Math.abs( S.rH ) > 2.5 && Math.abs( S.rV ) > 2.5 ) )
		issues.push( `node "${ ID }" is too small ( width / height must exceed 5px )` )
}

const
validateLink	= ( l, ids, seen, issues, i ) => {
	if	( !Array.isArray( l ) || !Array.isArray( l[ 0 ] ) ) {
		issues.push( `link[${ i }] must be [ [ from, to ], ends, paint? ]` )
		return
	}
	const	[ [ F, T ], A = {} ] = l
	if	( !F || !T )		{ issues.push( `link[${ i }] is missing an endpoint` ); return }
	if	( F === T )			issues.push( `link[${ i }] is a self-link on "${ F }"` )
	if	( !ids.has( F ) )	issues.push( `link[${ i }] from "${ F }" is not a node` )
	if	( !ids.has( T ) )	issues.push( `link[${ i }] to "${ T }" is not a node` )
	if	( A?.corner && !CORNER_STYLES.has( A.corner ) )	issues.push( `link[${ i }] corner must be sharp, arc, or curve` )
	const	key = `${ F }\u0000${ T }`
	if	( seen.has( key ) )	issues.push( `duplicate link ${ F } → ${ T }` )
	else					seen.add( key )
}

//	pure: returns an array of human-readable problems ( empty = valid )
export const
validateModel	= ( model = app.model ) => {
	const
	issues = []
	,	ids = new Set
	;( model.nodes ?? [] ).forEach( ( n, i ) => validateNode( n, ids, issues, i ) )
	const	seen = new Set
	;( model.links ?? [] ).forEach( ( l, i ) => validateLink( l, ids, seen, issues, i ) )
	return	issues
}

const
getModel		= () => structuredClone( app.model )

const
setModel		= model => SetModel( structuredClone( model ) )

//	deterministic layouts: the AI calls these instead of computing coordinates.
//	'grid' arranges nodes ( in model order ) into a uniform grid.
const
autoLayout		= ( { algorithm = 'grid', cols, gap = 48, startX = 200, startY = 200 } = {} ) => {
	const	src = app.model.nodes
	if	( !src.length ) return Promise.resolve()
	switch ( algorithm ) {
	case 'grid': {
		const
		c = cols || Math.ceil( Math.sqrt( src.length ) )
		,	cellW = Math.max( ...src.map( _ => 2 * Math.abs( _[ 1 ].rH ) ) ) + gap
		,	cellH = Math.max( ...src.map( _ => 2 * Math.abs( _[ 1 ].rV ) ) ) + gap
		,	nodes = src.map( ( node, i ) => {
			const
			col = i % c
			,	row = ( i / c ) | 0
			return	[ node[ 0 ], { ...node[ 1 ], cX: startX + col * cellW, cY: startY + row * cellH }, node[ 2 ] ]
		} )
		return	SetModel( { nodes, links: structuredClone( app.model.links ) } )
	}
	default:
		throw new Error( `unknown layout algorithm "${ algorithm }"` )
	}
}

//	single op → Application mutator ( own undo step when called alone )
const
mustFindNode	= id => {
	const
	node = FindNode( id )
	if	( !node ) throw new Error( `no such node: ${ id }` )
	return node
}

const
mustFindLink	= ( from, to ) => {
	const
	link = app.model.links.find( ( [ [ f, t ] ] ) => f === from && t === to )
	if	( !link ) throw new Error( `no such link: ${ from } → ${ to }` )
	return link
}

const
OPS				= {
	addNode		: a => Node( [ a.id ?? '', a.area, a.paint ?? {} ] )
,	updateNode	: a => {
		const
		node = mustFindNode( a.id )
		return EditNode( a.id, updateNodeArgs( a, node ) )
	}
,	removeNode	: a => RemoveNode( a.id )
,	restack		: a => Restack( a.id, a.toFront ?? true )
,	addLink		: a => Link( [ [ a.from, a.to ], a.ends ?? { headT: 'triangle' }, a.paint ?? {} ] )
,	updateLink	: a => {
		const
		link = mustFindLink( a.from, a.to )
		return EditLink( [ a.from, a.to ], updateLinkArgs( a, link ) )
	}
,	removeLink	: a => RemoveLink( [ a.from, a.to ] )
,	autoLayout	: a => autoLayout( a )
,	setCanvas	: a => ( SetCanvasSize( a.width, a.height ), MAIN_EDITOR.Draw() )
}

//	One apply() = one undo step. Any op failure rolls the whole batch back.
const
apply			= async ops => {
	if	( !Array.isArray( ops ) ) throw new Error( 'apply expects an array of ops' )
	if	( !ops.length ) throw new Error( 'apply expects a non-empty ops array' )
	const
	canvasBefore = CanvasSize()
	try {
		await DoTypical(
			'AI'
		,	() => withoutHistory(
				async () => {
					for	( const o of ops ) {
						const	fn = OPS[ o.op ]
						if	( !fn )	throw new Error( `unknown op "${ o.op }"` )
						await fn( o )
					}
				}
			)
		)
	} catch ( er ) {
		//	setCanvas is outside app.*; restore it if a later op failed.
		try { SetCanvasSize( ...canvasBefore ) } catch { /* keep throwing below */ }
		throw er
	}
	return	validateModel()
}

window.ZU = {
	getModel
,	setModel
,	validate	: validateModel
,	apply
,	autoLayout
,	canvasSize	: CanvasSize
,	...OPS
,	draw		: () => MAIN_EDITOR.Draw()
}
