import {
	LabeledInput
,	LabeledSelect
,	LabeledTextArea
} from './DomUtils.js'

//	pins as one "name": [ u, v, exit? ] entry per line, so each pin reads and edits on its own row
const
FormatPins		= pins => pins
?	'{\n' + Object.entries( pins ).map( ( [ k, v ] ) => ` ${ JSON.stringify( k ) }: ${ JSON.stringify( v ) }` ).join( '\n,' ) + '\n}'
:	''

//	the parsed pins object, undefined for an empty field; throws on anything else
const
ParsePins		= text => {
	if	( !text.trim() ) return undefined
	const	$ = JSON.parse( text )
	if	( !$ || typeof $ !== 'object' || Array.isArray( $ ) ) throw new Error( 'pins must be an object' )
	return	$
}

export default class
ShapeEditor extends HTMLElement {

	//	Build fields on connect, not in the constructor: a custom element whose
	//	constructor adds children can't be created via document.createElement
	//	( "the result must not have children" ), and node-editor nests this via createElement.
	connectedCallback() {
		if	( this.CX )	return

		this.CX				= LabeledInput		( this, 'cX'	, '100' )
		this.CY				= LabeledInput		( this, 'cY'	, '100' )
		this.RH				= LabeledInput		( this, 'rH'	, '100' )
		this.RV				= LabeledInput		( this, 'rV'	, '100' )
		this.RADII			= LabeledInput		( this, 'radii'	)

		this.TYPE			= LabeledSelect		( this, 'type'	, 'rect', 'ellipse', 'rhombus', 'PNG', 'SVG' )

		this.HTML			= LabeledTextArea	( this, 'HTML:'	)
		this.STYLE			= LabeledTextArea	( this, 'STYLE:')
		this.STYLE.value	= ';display    : grid\n;place-items: center'

		this.PINS			= LabeledTextArea	( this, 'PINS: { "name": [ u, v, exit? ] }' )
		this.PINS.oninput	= () => {
			try {
				ParsePins( this.PINS.value )
				this.PINS.setCustomValidity( '' )
			} catch ( er ) {
				this.PINS.setCustomValidity( er.message )
			}
			this.PINS.reportValidity()
		}
	}

	get	$() {
		const
		$ = {}

		this.CX		.value	&& ( $[ 'cX'	] = Number( this.CX		.value ) )
		this.CY		.value	&& ( $[ 'cY'	] = Number( this.CY		.value ) )
		this.RH		.value	&& ( $[ 'rH'	] = Number( this.RH		.value ) )
		this.RV		.value	&& ( $[ 'rV'	] = Number( this.RV		.value ) )
		this.RADII	.value	&& ( $[ 'radii'	] = Number( this.RADII	.value ) )

		this.TYPE	.value	&& ( $[ 'type'	] = this.TYPE	.value )
		this.HTML	.value	&& ( $[ 'html'	] = this.HTML	.value )
		this.STYLE	.value	&& ( $[ 'style'	] = this.STYLE	.value )

		//	unparsable pins keep the last loaded value ( the edit dialog's form blocks submit on them )
		const	K = this.KEEP ?? {}
		let		pins = K.pins
		try { pins = ParsePins( this.PINS.value ) } catch {}
		pins				&& ( $[ 'pins'	] = pins )

		//	image payloads have no form control: they ride through the edit untouched
		$.type === 'SVG'	&& K.SVG	&& ( $[ 'SVG'	] = K.SVG )
		$.type === 'PNG'	&& K.PNG	&& ( $[ 'PNG'	] = K.PNG )

		return $
	}

	set	$( _ ) {

		this.KEEP			= { SVG: _.SVG, PNG: _.PNG, pins: _.pins }

		this.CX		.value	= _.cX
		this.CY		.value	= _.cY
		this.RH		.value	= _.rH
		this.RV		.value	= _.rV
		this.RADII	.value	= _.radii	?? ''

		this.TYPE	.value	= _.type
		this.HTML	.value	= _.html	?? ''
		this.STYLE	.value	= _.style	?? ''
		this.PINS	.value	= FormatPins( _.pins )
		this.PINS.setCustomValidity( '' )
	}
}

customElements.define( 'shape-editor', ShapeEditor )

