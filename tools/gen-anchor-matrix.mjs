#!/usr/bin/env node
//	Generate Samples/AnchorMatrix.zu: every from-anchor × to-anchor pair
//	( 8 × 8 = 64 ), each a corner:'sharp' link between two rects, laid out in an
//	8 × 8 grid ( rows = from-anchor, cols = to-anchor ). Regenerate with:
//	  node tools/gen-anchor-matrix.mjs

import { writeFile }		from 'node:fs/promises'
import path				from 'node:path'
import { fileURLToPath }	from 'node:url'

const
ANCHORS		= [ 'T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR' ]

const
margin		= 48
,	titleH		= 40
,	colHdrH		= 30
,	headerH		= titleH + colHdrH
,	rowHdrW		= 64
,	cellW		= 250
,	cellH		= 210
,	gridLeft	= margin + rowHdrW
,	gridTop		= margin + headerH

const
nodes	= []
,	links	= []

const
LABEL_STYLE	= ';display:grid;place-items:center'

//	text-only node ( no box ): empty paint means nothing is stroked / filled, so
//	only the foreignObject html label shows
const
label	= ( id, cX, cY, rH, rV, html, fontSize = 13 ) => nodes.push( [
	id
,	{ type: 'rect', cX, cY, rH, rV, html, style: `${ LABEL_STYLE };font-size:${ fontSize }px` }
,	{}
] )

//	title band
label(
	'title'
,	gridLeft + 8 * cellW / 2
,	margin + titleH / 2
,	4 * cellW
,	16
,	'Anchor routing matrix — rows = from-anchor, cols = to-anchor ( corner: sharp )'
,	16
)

//	column headers ( to-anchor )
ANCHORS.forEach( ( aT, c ) => label(
	`colhdr.${ aT }`
,	gridLeft + c * cellW + cellW / 2
,	gridTop - colHdrH / 2
,	40
,	12
,	`→ ${ aT }`
,	14
) )

//	row headers ( from-anchor )
ANCHORS.forEach( ( aF, r ) => label(
	`rowhdr.${ aF }`
,	margin + rowHdrW / 2
,	gridTop + r * cellH + cellH / 2
,	28
,	14
,	`${ aF } →`
,	14
) )

//	the 64 cells
ANCHORS.forEach( ( aF, r ) => {
	ANCHORS.forEach( ( aT, c ) => {
		const
		cellX	= gridLeft + c * cellW
		,	cellY	= gridTop + r * cellH
		,	fromId	= `${ aF }-${ aT }.from`
		,	toId	= `${ aF }-${ aT }.to`

		nodes.push( [
			fromId
		,	{
				type	: 'rect'
			,	cX		: cellX + 84
			,	cY		: cellY + 66
			,	rH		: 50
			,	rV		: 28
			,	radii	: 6
			,	html	: `${ aF } → ${ aT }`
			,	style	: `${ LABEL_STYLE };font-size:12px`
			}
		,	{ stroke: 'gray', lineWidth: 1.5 }
		] )

		nodes.push( [
			toId
		,	{ type: 'rect', cX: cellX + 172, cY: cellY + 150, rH: 44, rV: 26, radii: 6 }
		,	{ stroke: 'gray', lineWidth: 1.5 }
		] )

		links.push( [
			[ fromId, toId ]
		,	{ anchorF: aF, anchorT: aT, corner: 'sharp', headT: 'triangle' }
		,	{ stroke: 'dodgerblue', lineWidth: 2 }
		] )
	} )
} )

const
OUT	= path.join(
	path.dirname( fileURLToPath( import.meta.url ) )
,	'..'
,	'Samples'
,	'AnchorMatrix.zu'
)

await writeFile( OUT, JSON.stringify( { model: { nodes, links } }, null, '\t' ) + '\n', 'utf8' )
console.log( `wrote ${ OUT }: ${ nodes.length } nodes, ${ links.length } links` )
