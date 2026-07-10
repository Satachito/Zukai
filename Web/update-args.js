//	Pure helpers for updateNode / updateLink argument resolution.
//	Omitted area / paint / ends keep the current values.

export const
updateNodeArgs	= ( a, node ) => [
	a.newId ?? a.id
,	a.area ?? node[ 1 ]
,	a.paint ?? node[ 2 ]
]

export const
updateLinkArgs	= ( a, link ) => [
	[ a.newFrom ?? a.from, a.newTo ?? a.to ]
,	a.ends ?? link[ 1 ]
,	a.paint ?? link[ 2 ]
]
