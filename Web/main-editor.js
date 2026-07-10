import {
	AE
}	from './DomUtils.js'

import {
	Report
,	FindNode
,	FindReform
,	AvailableLinks
,	Reform
,	Node
,	EditNode
,	Restack
,	Link
,	EditLink
,	RemoveLink
,	Delete
,	Copy
,	Paste
,	STORAGE_KEY
}	from './Application.js'

const
canvasStorageKey	= () => `${ STORAGE_KEY }.canvas`

const
loadStoredCanvasSize	= () => {
	try {
		const
		[ W, H ] = JSON.parse( localStorage.getItem( canvasStorageKey() ) )
		if	( W > 0 && H > 0 )	return [ W, H ]
	} catch {}
	return [ 4096, 4096 ]
}

export	const
CanvasSize		= () => MAIN_EDITOR.canvasSize()

export	const
SetCanvasSize	= ( W, H ) => {
	if	( !( W > 0 && H > 0 ) )	throw new Error( `Invalid canvas size: ${ W }×${ H }` )
	MAIN_EDITOR.setCanvasSize( W, H )
	localStorage.setItem( canvasStorageKey(), JSON.stringify( [ W, H ] ) )
}

import {
	Redo
,	Undo
}	from './Jobs.js'

import {
	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsXY
,	ContainsTLBR
,	AreaTLBR
,	Outset
,	XYWH_XYXY
,	XY_EV
,	AddXY
,	SubXY
,	DivXY
,	MulXY
,	DeltaXY
,	EqualXY
}	from './Geo2D.js'

import {
	XYWH
,	TLBR
,	BBox
,	GRAB
,	C2D
,	ArrowPathes
}	from './GeoZU.js'

const
PrepareCanvas	= _ => {
	const
	$ = _.getContext( '2d' )
	$.clearRect( 0, 0, _.width, _.height )
	return $
}

const
HeadAreaPath	= ( xyF, xyT ) => {
	const
	[ dX, dY ] = DeltaXY( xyF, xyT )
,	hypot = Math.hypot( dX, dY )

	const
	$ = new Path2D()
	if	( hypot < 1e-9 ) {
		$.arc( xyT[ 0 ], xyT[ 1 ], GRAB, 0, Math.PI * 2 )
		return $
	}
	$.arc(
		xyT[ 0 ] - dX / hypot * GRAB
	,	xyT[ 1 ] - dY / hypot * GRAB
	,	GRAB
	,	0
	,	Math.PI * 2
	)
	return $
}
const
DrawLinkCanvas	= ( c2D, _ ) => {
	const
	{	shaftPath
	,	headPathF
	,	strokeF
	,	headPathT
	,	strokeT
	} = ArrowPathes( _ )

	const
	[ , , P ] = _

	c2D.save()
	P.stroke			&& ( c2D.strokeStyle	= P.stroke			)
	P.lineWidth			&& ( c2D.lineWidth		= P.lineWidth		)
	P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
	P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
	P.lineDashOffset	&& ( c2D.lineDashOffset = P.lineDashOffset	)
	P.lineDash			&& c2D.setLineDash( P.lineDash )
	c2D.stroke( shaftPath )
	c2D.restore()

	c2D.save()
	c2D.fillStyle	= P.fill ?? P.stroke ?? 'dodgerblue'
	P.stroke	&& ( c2D.strokeStyle	= P.stroke		)
	P.lineWidth	&& ( c2D.lineWidth		= P.lineWidth	)
	c2D.lineJoin	= 'round'
	c2D.lineCap		= 'round'
	headPathF && ( strokeF ? c2D.stroke( headPathF ) : c2D.fill( headPathF ) )
	headPathT && ( strokeT ? c2D.stroke( headPathT ) : c2D.fill( headPathT ) )

	c2D.restore()
}

const
HitArrowPathes	= ( { shaftPath, xyF, xyT }, xy ) => {
	if	( C2D.isPointInPath( HeadAreaPath( xyF, xyT ), ...xy ) ) return true
	if	( C2D.isPointInPath( HeadAreaPath( xyT, xyF ), ...xy ) ) return true

	C2D.save()
	try {
		C2D.lineWidth = GRAB
		return C2D.isPointInStroke( shaftPath, ...xy )
	} finally {
		C2D.restore()
	}
}
const
HitLink			= ( _, xy ) => HitArrowPathes( ArrowPathes( _ ), xy )

import { mountSceneSvg, setSceneSize, paintScene } from './SceneSvg.js'

const
NodeMode = ev => CREATE_NODE.checked || !!ev?.metaKey
const
LinkMode = ev => CREATE_LINK.checked || !!ev?.altKey

const
Node_XY		= xy => {
	let	$ = null
	app.model.nodes.forEach(
		_ => {
			const _tlbr = TLBR( _[ 1 ] )
			if	( ContainsXY( Outset( _tlbr, GRAB ), xy ) ) {
				if	( $ ) {
					const _minEdgeDist	= Math.min( ...EdgeDist( _tlbr, xy ) )
					const tlbr			= TLBR( $[ 1 ] )
					const minEdgeDist	= Math.min( ...EdgeDist( tlbr, xy ) )
					_minEdgeDist < minEdgeDist
					?	$ = _
					:	_minEdgeDist === minEdgeDist && ( AreaTLBR( _tlbr ) < AreaTLBR( tlbr ) ) && ( $ = _ )
				} else {
					$ = _
				}
			}
		}
	)
	return	$
}
const
Node_EV		= ev => Node_XY( XY_EV( ev ) )

const
Links_XY	= xy => AvailableLinks().reduce(
	( $, _ ) => {
		HitLink( _, xy ) && $.push( _ )
		return $
	}
,	[]
)

//	which end zone ( if any ) of a single link the point lands on → 'F' | 'T'.
//	fixed GRAB-radius circles at each end, on the shaft side of the boundary tip
//	— so the head menu is reachable even when that end currently has no arrowhead,
//	and clicks never fall onto the node.
const
HeadEndPathes_XY	= ( { xyF, xyT }, xy ) => {
	if	( C2D.isPointInPath( HeadAreaPath( xyF, xyT ), ...xy ) ) return 'T'
	if	( C2D.isPointInPath( HeadAreaPath( xyT, xyF ), ...xy ) ) return 'F'
	return null
}
const
ContextLink_XY	= xy => {
	let
	link = null
	for ( const _ of AvailableLinks() ) {
		const
		pathes = ArrowPathes( _ )
		const
		end = HeadEndPathes_XY( pathes, xy )
		if	( end ) return { head: { link: _, end }, link: null }
		!link && HitArrowPathes( pathes, xy ) && ( link = _ )
	}
	return	{ head: null, link }
}

const
BBoxGrabCursor	= ( bbox, xy ) => {
	const
	[ T, L, B, R ] = EdgeDist( bbox, xy ).map( _ => _ <= 0 )

	if	( ( T && L ) || ( B && R ) ) return 'nwse-resize'
	if	( ( T && R ) || ( B && L ) ) return 'nesw-resize'

	if	( T || B ) return 'ns-resize'
	if	( L || R ) return 'ew-resize'

	return 'move'
}

const
Cursor_EV	= ev => {
	
	if	( NodeMode( ev ) )								return 'crosshair'

	const
	xy = XY_EV( ev )

	if	( app.reforms.length ) {
		const
		bbox = BBox( app.reforms )
		if	( ContainsXY( Outset( bbox, GRAB ), xy ) )	return ContainsXY( bbox, xy ) ? 'move' : BBoxGrabCursor( bbox, xy )
	}

	if	( Links_XY( xy ).length )						return 'pointer'

	const
	$ = Node_XY( xy )

	if	( $ )											return LinkMode( ev ) ? 'crosshair' :	BBoxGrabCursor( TLBR( $[ 1 ] ), xy )

	return 'default'
}



const
copyText		= text => navigator.clipboard.writeText( text ).catch( Report )

const
ShowHoverLabel = ( ev, text ) => {
	UNDER_HOVER.textContent		= text
	UNDER_HOVER.style.display	= 'block'
	UNDER_HOVER.style.left		= `${ ev.clientX + 12 }px`
	UNDER_HOVER.style.top		= `${ Math.max( 8, ev.clientY - 28 ) }px`
}
const
UpdateHoverLabel = ev => {
	const
	xy = XY_EV( ev )
	//	links take priority over nodes ( same as the pointer cursor ), so a link
	//	running under a node still reports its endpoints rather than the node id
	const
	links = Links_XY( xy )
	if	( links.length ) {
		const	[ [ nF, nT ] ] = links[ 0 ]
		return ShowHoverLabel( ev, `${ nF[ 0 ] } - ${ nT[ 0 ] }` )
	}
	const
	node = Node_XY( xy )
	if	( !node ) {
		UNDER_HOVER.style.display = 'none'
		return
	}
	ShowHoverLabel( ev, node[ 0 ] )
}


export default class
MainEditor extends HTMLElement {

	Draw() {
		window.EMPTY_HINT && ( window.EMPTY_HINT.style.display = app.model.nodes.length ? 'none' : '' )
		return Promise.all( [ this.DrawModel(), this.DrawReforms() ] ).catch( Report )
	}

	canvasSize() {
		return	[ this.reformer.width, this.reformer.height ]
	}

	setCanvasSize( w, h ) {
		if	( !( w > 0 && h > 0 ) )	throw new Error( `Invalid canvas size: ${ w }×${ h }` )
		this.reformer.width		= w
		this.reformer.height	= h
		setSceneSize( this.scene, w, h )
	}

	clearInteraction() {
		this.gesture = null
	}

	DrawModel() {
		paintScene( this.scene, app.model )
	}

	DrawReforms() {
		const
		c2D = PrepareCanvas( this.reformer )

		//	redraw every link touching the selection: a moving end follows its
		//	reform clone, a fixed end stays on its model node ( so half-selected
		//	links track the drag instead of being left behind )
		for ( const [ [ F, T ], A, P ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			if	( !rF && !rT ) continue
			const	nF = rF || FindNode( F )
			const	nT = rT || FindNode( T )
			nF && nT && DrawLinkCanvas( c2D, [ [ nF, nT ], A, P ] )
//			c2D, nF[ 1 ], A, nT[ 1 ], S, { paintF: nF[ 2 ], paintT: nT[ 2 ] }
		}

		if	( app.reforms.length ) {
			c2D.save()
			c2D.strokeStyle = '#00ffff'
			c2D.lineWidth = 4
			for ( const [ , S ] of app.reforms ) c2D.strokeRect( ...XYWH( S ) )
			c2D.strokeStyle = '#ff0000'
			c2D.lineWidth = 2
			const	[ hT, hL, hB, hR ] = BBox( app.reforms )
			c2D.strokeRect( ...XYWH_TLBR( [ hT, hL, hB, hR ] ) )
			//	resize handles: 4 corners fully outside the selection box
			const	HS = 8, gap = 1
			c2D.fillStyle = '#ffffff'
			c2D.lineWidth = 1.5
			for ( const [ x, y ] of [
				[ hL - HS, hT - HS ]
			,	[ hR + gap, hT - HS ]
			,	[ hL - HS, hB + gap ]
			,	[ hR + gap, hB + gap ]
			] ) {
				c2D.fillRect( x, y, HS, HS )
				c2D.strokeRect( x, y, HS, HS )
			}
			c2D.restore()
		}
	}

	constructor() {
		super()

		this.style.position			= 'relative'

		this.scene					= mountSceneSvg( this )
		this.reformer				= AE( this, 'canvas' )
		this.reformer.style.position	= 'absolute'
		//	stop the browser from claiming the drag as a scroll / gesture ( which
		//	would fire pointercancel and abort the move before pointerup commits )
		this.reformer.style.touchAction	= 'none'
		this.setCanvasSize( ...loadStoredCanvasSize() )
		this.linkMenuKey			= null
		this.headMenuTarget			= null
		this.nodeMenuTarget			= null
		this.gesture				= null	//	one active gesture at a time: { pan: { x, y } } | { draw, commit } | null
		this.spaceDown				= false	//	space held → hand tool armed
		this.hoverXY				= null	//	last hover position, for refreshModeCursor

		LINK_MENU_EDIT.onclick	= async ev => {
			ev.stopPropagation()
			const
			key = this.linkMenuKey
			this.hideContextMenus()
			key && await this.editLink( key )
		}

		LINK_MENU_REMOVE.onclick	= ev => (
			ev.stopPropagation()
		,	this.linkMenuKey && RemoveLink( [ this.linkMenuKey[ 0 ], this.linkMenuKey[ 1 ] ] )
		,	this.hideContextMenus()
		)

		for ( const b of HEAD_MENU.querySelectorAll( 'button.head-opt' ) ) {
			b.onclick = ev => (
				ev.stopPropagation()
			,	this.setLinkHead( b.dataset.head || '' )
			,	this.hideContextMenus()
			)
		}

		NODE_MENU_EDIT.onclick	= async ev => {
			ev.stopPropagation()
			const
			target = this.nodeMenuTarget
			this.hideContextMenus()
			target && await this.editNode( target )
		}

		NODE_MENU_FRONT.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Restack( this.nodeMenuTarget[ 0 ], true )
		,	this.hideContextMenus()
		)

		NODE_MENU_BACK.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Restack( this.nodeMenuTarget[ 0 ], false )
		,	this.hideContextMenus()
		)

		NODE_MENU_DELETE.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Delete()
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_ID.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 0 ] )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_HTML.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].html ?? '' )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_STYLE.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].style ?? '' )
		,	this.hideContextMenus()
		)

		//	window-level: catches clicks outside main-editor too
		//	capture(true): runs before stopPropagation() in menu onclick handlers
		addEventListener( 'pointerdown', ev => {
			if	( LINK_MENU.style.display === 'none' && HEAD_MENU.style.display === 'none' && NODE_MENU.style.display === 'none' ) return
			if	( LINK_MENU.contains( ev.target ) || HEAD_MENU.contains( ev.target ) || NODE_MENU.contains( ev.target ) ) return
			this.hideContextMenus()
		}, true )

		this.reformer.oncontextmenu	= ev => this.onContextMenu( ev )
		this.reformer.oncopy		= ev => ( ev.preventDefault(), Copy( ev.clipboardData ) )
		this.reformer.oncut			= ev => ( this.reformer.oncopy( ev ), Delete() )
		this.reformer.onpaste		= ev => ( ev.preventDefault(), Paste( ev.clipboardData ) )

		//	window-level so shortcuts work without the canvas being focused
		addEventListener( 'keydown', ev => this.onKeyDown( ev ) )
		//	⌘/⌥ momentarily act as Create-node / Create-link; refresh cursor on release
		addEventListener( 'keyup', ev => this.onKeyUp( ev ) )
		//	entering create-node mode: clear NODE_ID so the placeholder ( the next
		//	auto-id ) shows and a previously selected node's id can't pollute the new node
		CREATE_NODE.onchange = () => (
			CREATE_NODE.checked && (
				NODE_ID.value = ''
			,	NODE_ID.placeholder = String( Date.now() )
			)
		,	this.refreshModeCursor()
		)
		CREATE_LINK.onchange = () => this.refreshModeCursor()

		//	keep the auto-id placeholder current whenever the empty field is focused
		NODE_ID.addEventListener(
			'focus'
		,	() => NODE_ID.value || ( NODE_ID.placeholder = String( Date.now() ) )
		)

		//	show a live auto-id placeholder from the start
		NODE_ID.placeholder = String( Date.now() )

		//	Pointer Capture: once a drag starts we capture the pointer so move/up
		//	are delivered to the canvas even when the cursor leaves it — the release
		//	(commit) is never lost over a panel or off-window.
		this.reformer.onpointerleave	= () => ( UNDER_HOVER.style.display = 'none' )
		//	suppress middle-click autoscroll so middle-drag can pan instead
		this.reformer.addEventListener( 'mousedown', ev => ev.button === 1 && ev.preventDefault() )
		this.reformer.onpointerdown		= ev => this.onMouseDown( ev )
		this.reformer.onpointermove		= ev => this.onMouseMove( ev )
		this.reformer.onpointerup		= ev => this.onMouseUp( ev )
		//	if the browser cancels the pointer mid-drag, commit what we have rather
		//	than silently dropping it ( onMouseUp no-ops when nothing was dragged )
		this.reformer.onpointercancel	= ev => this.onMouseUp( ev )

		matchMedia( '(prefers-color-scheme: dark)' ).addEventListener(
			'change'
		,	() => this.Draw()
		)
	}

	setLinkHead( style ) {
		if	( !this.headMenuTarget ) return
		const
		{ F, T, end } = this.headMenuTarget
		,	link = app.model.links.find( ( [ [ f, t ] ] ) => f === F && t === T )
		if	( !link ) return
		const
		A = structuredClone( link[ 1 ] ?? {} )
		,	key = end === 'F' ? 'headF' : 'headT'
		style ? ( A[ key ] = style ) : ( delete A[ key ] )
		void Link( [ [ F, T ], A, link[ 2 ] ] )
	}

	hideContextMenus( focusReformer = true ) {
		LINK_MENU.style.display	= 'none'
		HEAD_MENU.style.display	= 'none'
		NODE_MENU.style.display	= 'none'
		this.linkMenuKey		= null
		this.headMenuTarget		= null
		this.nodeMenuTarget		= null
		focusReformer && this.reformer.focus()
	}

	positionContextMenu( menu, ev ) {
		const	pad	= 8
		const	w	= menu.offsetWidth	|| 120
		const	h	= menu.offsetHeight	|| 40
		menu.style.left	= `${ Math.max( pad, Math.min( ev.clientX, innerWidth - w - pad ) ) }px`
		menu.style.top	= `${ Math.max( pad, Math.min( ev.clientY, innerHeight - h - pad ) ) }px`
	}

	//	modal prompt for a new node's id. Resolves '' ( auto-assign ), the typed id,
	//	or null when cancelled. Rejects a typed id that already exists ( keeps open ).
	promptNodeId() {
		return	new Promise( resolve => {
			const
			finish = val => {
				NODE_ID_DIALOG_FORM.onsubmit	= null
				NODE_ID_DIALOG_CANCEL.onclick	= null
				NODE_ID_DIALOG.oncancel			= null
				NODE_ID_DIALOG.open && NODE_ID_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			NODE_ID_DIALOG_INPUT.value			= ''
			NODE_ID_DIALOG_INPUT.placeholder	= String( Date.now() )
			NODE_ID_DIALOG_ERR.textContent		= ''
			NODE_ID_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				v = NODE_ID_DIALOG_INPUT.value.trim()
				if	( v && FindNode( v ) ) {
					NODE_ID_DIALOG_ERR.textContent = `ID "${ v }" already exists`
					return
				}
				finish( v )
			}
			NODE_ID_DIALOG_CANCEL.onclick	= () => finish( null )
			NODE_ID_DIALOG.oncancel			= ev => ( ev.preventDefault(), finish( null ) )
			NODE_ID_DIALOG.showModal()
			NODE_ID_DIALOG_INPUT.focus()
		} )
	}

	async editLink( [ F, T ] ) {
		const
		link = app.model.links.find( ( [ [ f, t ] ] ) => f === F && t === T )
		if	( !link ) return
		LINK_EDITOR.$	= [ [ F, T ], link[ 1 ] ?? {}, link[ 2 ] ?? {} ]
		//	borrow the aside link-editor into the modal, then return it on close
		LINK_EDITOR_SLOT.appendChild( LINK_EDITOR )
		let	$
		try {
			$ = await this.promptLinkEndpoints( F, T )
		} finally {
			LINK_EDITOR_HOME.appendChild( LINK_EDITOR )
		}
		if	( !$ ) return
		await EditLink( [ F, T ], $ )
		this.reformer.focus()
	}

	//	modal hosting the full link-editor. Resolves the edited [ [ F, T ], A, P ]
	//	or null when cancelled. Rejects a self-link or a duplicate of another link.
	promptLinkEndpoints( F, T ) {
		return	new Promise( resolve => {
			LINK_EDGE_DIALOG_ERR.textContent	= ''

			const
			finish = val => {
				LINK_EDGE_DIALOG_FORM.onsubmit	= null
				LINK_EDGE_DIALOG_CANCEL.onclick	= null
				LINK_EDGE_DIALOG.oncancel		= null
				LINK_EDGE_DIALOG.open && LINK_EDGE_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			LINK_EDGE_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				$ = LINK_EDITOR.$			//	[ [ nF, nT ], A, P ]
				,	[ [ nF, nT ] ] = $
				if	( nF === nT ) {
					LINK_EDGE_DIALOG_ERR.textContent = 'from and to are the same'
					return
				}
				if	(
					( nF !== F || nT !== T )
				&&	app.model.links.some( ( [ [ f, t ] ] ) => f === nF && t === nT )
				) {
					LINK_EDGE_DIALOG_ERR.textContent = `link ${ nF } → ${ nT } already exists`
					return
				}
				finish( $ )
			}
			LINK_EDGE_DIALOG_CANCEL.onclick	= () => finish( null )
			LINK_EDGE_DIALOG.oncancel		= ev => ( ev.preventDefault(), finish( null ) )
			LINK_EDGE_DIALOG.showModal()
		} )
	}

	async editNode( node ) {
		NODE_ID.value	= node[ 0 ]
		NODE_EDITOR.$	= [ node[ 1 ], node[ 2 ] ]
		//	borrow the aside node-editor ( + id row ) into the modal, return on close
		NODE_EDITOR_SLOT.append( NODE_ID_ROW, NODE_EDITOR )
		let	$
		try {
			$ = await this.promptNode( node[ 0 ] )
		} finally {
			NODE_EDITOR_HOME.append( NODE_ID_ROW, NODE_EDITOR )
		}
		if	( !$ ) return
		await EditNode( node[ 0 ], $ )
		this.reformer.focus()
	}

	//	modal hosting the full node-editor. Resolves the edited [ ID, S, P ] or
	//	null when cancelled. Rejects an empty id or one taken by another node.
	promptNode( oldID ) {
		return	new Promise( resolve => {
			NODE_EDIT_DIALOG_ERR.textContent	= ''

			const
			finish = val => {
				NODE_EDIT_DIALOG_FORM.onsubmit	= null
				NODE_EDIT_DIALOG_CANCEL.onclick	= null
				NODE_EDIT_DIALOG.oncancel		= null
				NODE_EDIT_DIALOG.open && NODE_EDIT_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			NODE_EDIT_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				id = NODE_ID.value.trim()
				,	[ S, P ] = NODE_EDITOR.$
				if	( !id ) {
					NODE_EDIT_DIALOG_ERR.textContent = 'ID is required'
					return
				}
				if	( id !== oldID && FindNode( id ) ) {
					NODE_EDIT_DIALOG_ERR.textContent = `ID "${ id }" already exists`
					return
				}
				finish( [ id, S, P ] )
			}
			NODE_EDIT_DIALOG_CANCEL.onclick	= () => finish( null )
			NODE_EDIT_DIALOG.oncancel		= ev => ( ev.preventDefault(), finish( null ) )
			NODE_EDIT_DIALOG.showModal()
		} )
	}

	//	add a node (clone) to the selection if not already present
	registReform( _ ) {
		return FindReform( _[ 0 ] ) || app.reforms.push( structuredClone( _ ) )
	}

	async selectAll() {
		app.reforms = app.model.nodes.map( _ => structuredClone( _ ) )
		await this.DrawReforms()
	}

	setEditor( node ) {
		NODE_ID.value		= node[ 0 ]
		NODE_EDITOR.$		= [ node[ 1 ], node[ 2 ] ]
	}

	//	the reform with the largest area ( rH * rV ); used to decide which node a
	//	multi-select move / resize should leave in the node editor
	largestReform() {
		return	app.reforms.reduce(
			( best, _ ) =>
				!best || _[ 1 ].rH * _[ 1 ].rV > best[ 1 ].rH * best[ 1 ].rV ? _ : best
		,	null
		)
	}

	setEditorToLargestReform() {
		const
		_ = this.largestReform()
		_ && this.setEditor( _ )
	}

	//	shift+click: extend the selection with the node and everything it contains
	async addWithContained( node ) {
		NODE_ID.value		= node[ 0 ]
		NODE_EDITOR.$		= [ node[ 1 ], node[ 2 ] ]
		const
		tlbr = TLBR( node[ 1 ] )
		this.registReform( node )
		app.model.nodes.forEach(
			_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
		)
		await this.DrawReforms()
	}

	//	⌘E: expand the current selection to include everything it contains
	//	(a node with nothing inside it simply stays as-is). Selection only,
	//	so it is not part of the undo history.
	async expand() {
		if	( !app.reforms.length ) return
		app.reforms.slice().forEach(
			reform => {
				const
				node = FindNode( reform[ 0 ] )
				if	( !node ) return
				const
				tlbr = TLBR( node[ 1 ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
			}
		)
		await this.DrawReforms()
	}

	async onContextMenu( ev ) {
		const
		xy = XY_EV( ev )
		const
		{ head, link } = ContextLink_XY( xy )
		//	an arrowhead is the most specific target → its own style menu
		if	( head ) {
			ev.preventDefault()
			this.hideContextMenus( false )
			const
			[ [ nF, nT ], A ] = head.link
			this.headMenuTarget	= { F: nF[ 0 ], T: nT[ 0 ], end: head.end }
			const
			cur = ( head.end === 'F' ? A.headF : A.headT ) || ''
			for ( const b of HEAD_MENU.querySelectorAll( 'button.head-opt' ) )
				b.classList.toggle( 'active', ( b.dataset.head || '' ) === cur )
			HEAD_MENU.style.display	= 'block'
			this.positionContextMenu( HEAD_MENU, ev )
			return
		}
		if	( link ) {
			ev.preventDefault()
			this.hideContextMenus( false )
			this.linkMenuKey	= link[ 0 ].map( _ => _[ 0 ] )	//	[ nodeF, nodeT ] → [ idF, idT ]
			LINK_MENU.style.display	= 'block'
			this.positionContextMenu( LINK_MENU, ev )
			return
		}
		const
		node = Node_EV( ev )
		if	( ! node ) return
		ev.preventDefault()
		this.hideContextMenus( false )

		app.reforms			= []
		this.registReform( node )
		await this.DrawReforms()

		this.setEditor( node )

		this.nodeMenuTarget		= node
		NODE_MENU.style.display	= 'block'
		this.positionContextMenu( NODE_MENU, ev )
	}

//	Key down / up は本体についてるよ！
	async onKeyDown( ev ) {
		const	t = ev.target
		if	( t && ( /^(INPUT|TEXTAREA|SELECT)$/.test( t.tagName ) || t.isContentEditable ) ) return
		switch ( ev.key ) {
		case 'z':	case 'Z':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await ( ev.shiftKey ? Redo() : Undo() ) }
			break
		case 'y':	case 'Y':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await Redo() }
			break
		case 'a':	case 'A':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.selectAll() }
			break
		case 'e':	case 'E':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.expand() }
			break
		case 'Escape':
			ev.preventDefault()
			this.gesture = null
			this.hideContextMenus()
			app.reforms.length = 0
			await this.DrawReforms()
			break
		case 'Delete':
		case 'Backspace':
			ev.preventDefault()
			await Delete()
			break
		case ' ':
			//	space arms the hand tool ( space + left-drag pans )
			ev.preventDefault()
			this.spaceDown = true
			this.reformer.style.cursor = 'grab'
			break
		default:
			break
		}
	}
	async onKeyUp( ev ) {
		ev.key === ' ' && ( this.spaceDown = false )
		this.reformer.style.cursor = Cursor_EV( ev )
	}

	//	idle / hover cursor. Recompute from the last hover position so that pressing
	//	a key that doesn't change the mode ( e.g. Shift while resizing an edge ) keeps
	//	the resize / move / pointer affordance instead of snapping back to 'default'.
	refreshModeCursor( ev ) {
		if	( this.gesture )	return	//	mid-gesture: keep the current cursor
		if	( this.spaceDown ) {
			this.reformer.style.cursor = 'grab'
			return
		}
		this.reformer.style.cursor = this.hoverXY
		?	Cursor_EV( { offsetX: this.hoverXY[ 0 ], offsetY: this.hoverXY[ 1 ], metaKey: ev?.metaKey, altKey: ev?.altKey } )
		:	( ( NodeMode( ev ) || LinkMode( ev ) ) ? 'crosshair' : 'default' )
	}

	onMouseMove( ev ) {
		if	( this.gesture ) {
			this.gesture.move( ev )
			return
		}
		this.hoverXY = [ ev.offsetX, ev.offsetY ]	//	remembered for refreshModeCursor
		this.reformer.style.cursor = Cursor_EV( ev )
		UpdateHoverLabel( ev )
	}

	async onMouseUp( ev ) {
		this.gesture && (
			await this.gesture.up( ev )
		,	this.gesture = null
		,	this.setEditorToLargestReform()
		)
	}
	async onMouseDown( ev ) {

		this.reformer.tabIndex = 0

		//	PAN ( middle-drag or space + drag ): scroll by raw client delta, no commit
		if	( ev.button === 1 || this.spaceDown ) {
			ev.pointerId != null && this.reformer.setPointerCapture( ev.pointerId )
			this.reformer.style.cursor = 'grabbing'
			let	last = [ ev.clientX, ev.clientY ]
			this.gesture = {
				move	: _ => {
					this.scrollLeft	-= _.clientX - last[ 0 ]
					this.scrollTop	-= _.clientY - last[ 1 ]
					last = [ _.clientX, _.clientY ]
				}
			,	up		: _ => ( this.reformer.style.cursor = Cursor_EV( _ ) )
			}
			return
		}
		if	( ev.button !== 0 ) return

		ev.pointerId != null && this.reformer.setPointerCapture( ev.pointerId )

		const
		xy	= XY_EV( ev )

		this.gesture = {
			downXY	: xy
		,	move	: _ => this.gesture.track && this.gesture.track(
				PrepareCanvas( this.reformer )
			,	xy
			,	XY_EV( _ )
			)
			//	async / await for dialog input; skip commit on a click with no drag
			//	( so a plain click makes no zero-size node / self-link )
		,	up		: async _ => {
				const
				upXY = XY_EV( _ )
				this.gesture.commit && !EqualXY( xy, upXY ) && await this.gesture.commit( xy, upXY )
			}
		}

		let
		needsRedraw	= false

		const
		resize = ( c2D, [ x, y ], [ X, Y ] ) => {
			const	origins = app.reforms.map( _ => FindNode( _[ 0 ] ) )
			if	( origins.some( _ => !_ ) )	return	//	a reform's node was deleted mid-drag
			const	tlbr = BBox( origins )
			const	edgeDist = EdgeDist( tlbr, xy )
			const	[ t, l, b, r ] = tlbr
			const	T = edgeDist[ 0 ] <= GRAB ? Y : t
			const	L = edgeDist[ 1 ] <= GRAB ? X : l
			const	B = edgeDist[ 2 ] <= GRAB ? Y : b
			const	R = edgeDist[ 3 ] <= GRAB ? X : r
			const	scaleX	= ( R - L ) / ( r - l || 1 )
			const	scaleY	= ( B - T ) / ( b - t || 1 )
			const	tX = L - l * scaleX
			const	tY = T - t * scaleY
			app.reforms.forEach(
				( [ ID, S ] ) => {
					const	[ t, l, b, r ] = TLBR( FindNode( ID )[ 1 ] )
					const	T = t * scaleY + tY
					const	L = l * scaleX + tX
					const	B = b * scaleY + tY
					const	R = r * scaleX + tX
					S.cX = ( L + R ) / 2
					S.cY = ( T + B ) / 2
					S.rH = ( R - L ) / 2
					S.rV = ( B - T ) / 2
				}
			)
			this.DrawReforms()
		}	

		const
		move = ( c2D, xy, XY ) => {
			const	[ dX, dY ] = DeltaXY( xy, XY )
			app.reforms.forEach(
				( [ ID, S ] ) => {
					const	found = FindNode( ID )
					if	( !found )	return
					S.cX = found[ 1 ].cX + dX
					S.cY = found[ 1 ].cY + dY
				}
			)
			this.DrawReforms()
		}
		const
		create	= ( c2D, xy, XY ) => {
			const
			P = NODE_EDITOR.PAINT.$
			c2D.save()
			c2D.strokeStyle = P.stroke || 'dodgerblue'
			c2D.lineWidth = Number( P.lineWidth || 2 )
			c2D.lineCap = P.lineCap || 'butt'
			c2D.strokeRect( ...XYWH_XYXY( [ xy, XY ] ) )
			c2D.restore()
		}
		const
		commitCreate = async ( xy, XY ) => {
			const	[ S, P ] = NODE_EDITOR.$
			const	r = DivXY( DeltaXY( xy, XY ), 2 )
			const	c = AddXY( xy, r )
			S.cX = c[ 0 ]
			S.cY = c[ 1 ]
			S.rH = Math.abs( r[ 0 ] )
			S.rV = Math.abs( r[ 1 ] )
			const	id = await this.promptNodeId()
			if	( id === null ) return
			await Node( [ id, S, P ] )
		}
		const
		link	= ( c2D, xy, XY ) => {
			const	P = LINK_EDITOR.PAINT.$
			c2D.save()
			c2D.strokeStyle = P.stroke || 'dodgerblue'
			c2D.lineWidth = Number( P.lineWidth || 2 )
			c2D.lineCap = P.lineCap || 'butt'
			c2D.beginPath()
			c2D.moveTo( ...xy )
			c2D.lineTo( ...XY )
			c2D.stroke()
			c2D.restore()
		}
		const
		commitLink = async ( xy, XY ) => {
			const	F = Node_XY( xy );	if	( F === null ) return
			const	T = Node_XY( XY );	if	( T === null ) return
			const	[ , A, P ] = LINK_EDITOR.$
			const	$ = [ [ F[ 0 ], T[ 0 ] ], A, P ]
			await Link( $ )
			LINK_EDITOR.$	= $	//	reflect the just-created link in the editor
		}
		const
		area	= ( c2D, xy, XY ) => {
			c2D.save()
			c2D.strokeStyle = 'lightgray'
			c2D.strokeRect( ...XYWH_XYXY( [ xy, XY ] ) )
			c2D.restore()
		}
		const
		commitArea = async ( xy, XY ) => {
			const	tlbr = TLBR_XYXY( [ xy, XY ] )
			app.model.nodes.forEach(
				_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
			)
			await Reform()
		}

		try {	//	for redrawing
//	NODE MODE
			if	( NodeMode( ev ) ) {
				this.gesture.track = create
				this.gesture.commit = commitCreate
				if	( app.reforms.length ) {
					app.reforms.length = 0
					needsRedraw = true
				}
				return
			}

//	SELECTION
			if	( app.reforms.length ) {
				const
				bbox = BBox( app.reforms )

//	SELECTION GRAB / INSIDE
				if	( ContainsXY( Outset( bbox, GRAB ), xy ) ) {
					this.gesture.track = ContainsXY( bbox, xy ) ? move : resize
					this.gesture.commit = Reform
					return
				}
//	SELECTION OUTSIDE
				app.reforms.length = 0
				needsRedraw = true
			}

//	LINK
			for	( const link of AvailableLinks() ) {
				const
				[ [ nF, nT ], A, P ] = link
				HitLink( link, xy ) && (
					this.registReform( nF )
				,	this.registReform( nT )
				,	LINK_EDITOR.$ = [ [ nF[ 0 ], nT[ 0 ] ], A, P ]
				)
			}
			if	( app.reforms.length ) {
				needsRedraw = true
				this.gesture.track = move
				this.gesture.commit = Reform
				return
			}

			const
			$ = Node_EV( ev )
			$ ?	(
				this.setEditor( $ )
			,	LinkMode( ev ) ? (
					this.gesture.track = link
					,	this.gesture.commit = commitLink
				)
				: (	ev.shiftKey
					?	this.registReform( $ )
					:	this.addWithContained( $ )
				,	this.gesture.track = ContainsXY( TLBR( $[ 1 ] ), xy ) ? move : resize
				,	this.gesture.commit = Reform
				)
			)
			: (	this.gesture.track = area
			,	this.gesture.commit = commitArea
			)
		} finally {
			needsRedraw && await this.DrawReforms()
		}
	}
}

customElements.define( 'main-editor', MainEditor )
