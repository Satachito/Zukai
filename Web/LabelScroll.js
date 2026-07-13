//	Scrollable node labels: detect overflow areas and let pointer / wheel reach them
//	through the editor overlay canvas.

export const
SCROLL_MARKER	= 'data-zu-scroll'

const
OVERFLOW_SCROLL_RE	= /(?:^|;)\s*overflow(?:-(?:x|y))?\s*:\s*(?:auto|scroll)/i

export const
hasScrollableLabel	= S => {
	if	( !S?.html ) return false
	if	( OVERFLOW_SCROLL_RE.test( String( S.style || '' ) ) ) return true
	const
	html = String( S.html )
	return	/<[a-z][^>]*\bdata-zu-scroll\b/i.test( html ) || OVERFLOW_SCROLL_RE.test( html )
}

const
overflowAllowsScroll	= v => v === 'auto' || v === 'scroll'

export const
isScrollableElement	= el => {
	if	( !el || el.nodeType !== 1 ) return false
	if	( el.hasAttribute?.( SCROLL_MARKER ) ) return true
	const
	{ overflow, overflowX, overflowY } = getComputedStyle( el )
	if	( !(
			overflowAllowsScroll( overflow )
		||	overflowAllowsScroll( overflowX )
		||	overflowAllowsScroll( overflowY )
		) ) return false
	return	el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
}

const
scrollableAncestor	= ( el, scene ) => {
	for ( let cur = el; cur && scene.contains( cur ); cur = cur.parentElement ) {
		if	( cur.tagName?.toLowerCase() === 'foreignobject' ) break
		if	( isScrollableElement( cur ) ) return cur
	}
	return null
}

//	True when any node label opts into scroll forwarding ( rare; skip probe otherwise ).
export const
modelHasScrollableLabel	= model =>
	( model?.nodes ?? [] ).some( ( [ , S ] ) => hasScrollableLabel( S ) )

//	Probe with the overlay transparent so elementsFromPoint reaches foreignObject HTML.
//	Toggling pointer-events fires pointerleave on the canvas — callers must ignore that
//	leave ( see MainEditor.probingLabelScroll ) or the hover-id tooltip vanishes.
export const
labelScrollTargetAtPoint	= ( editor, clientX, clientY ) => {
	const
	scene = editor.scene
	,	reformer = editor.reformer
	if	( !scene || !reformer ) return null
	if	( !modelHasScrollableLabel( globalThis.app?.model ) ) {
		reformer.style.pointerEvents = 'auto'
		return null
	}

	editor.probingLabelScroll = true
	try {
		reformer.style.pointerEvents = 'none'
		const
		stack = document.elementsFromPoint( clientX, clientY )
		let	target = null
		for ( const el of stack ) {
			if	( !scene.contains( el ) ) continue
			target = scrollableAncestor( el, scene )
			if	( target ) break
		}
		reformer.style.pointerEvents = target ? 'none' : 'auto'
		return	target
	} finally {
		editor.probingLabelScroll = false
	}
}

//	Grid children default to min-height:auto and grow with content inside
//	foreignObject — pin scroll regions to the node box after paint.
export const
layoutScrollableLabels	= scene => {
	if	( !scene ) return

	for ( const el of scene.querySelectorAll( `[${ SCROLL_MARKER }]` ) ) {
		el.style.minHeight = '0'
		el.style.overflowY ||= 'auto'

		const
		grid = el.parentElement
		if	( grid && getComputedStyle( grid ).display === 'grid' ) {
			grid.style.height = '100%'
			grid.style.minHeight = '0'
			grid.style.overflow = 'hidden'
			grid.style.boxSizing = 'border-box'
		}
	}
}
