import { test, before }	from 'node:test'
import assert			from 'node:assert/strict'
import { parseHTML }	from 'linkedom'

before( () => {
	const
	{ window } = parseHTML( '<!doctype html><html><body></body></html>' )
	globalThis.DOMParser		= window.DOMParser
	globalThis.XMLSerializer	= window.XMLSerializer
} )

const
{ sanitizeLabelHtml, sanitizeStyle, labelContentRisks, modelRiskyLabelNodes } = await import( '../SanitizeLabel.js' )

test( 'keeps sample-style markup', () => {
	assert.equal(
		sanitizeLabelHtml( 'Zukai<br><b>Feature Showcase</b>' )
	,	'Zukai<br/><b>Feature Showcase</b>'
	)
	assert.equal(
		sanitizeLabelHtml( '<b>fill</b> + <span style="color:#1f6feb">stroke</span>' )
	,	'<b>fill</b> + <span style="color:#1f6feb">stroke</span>'
	)
	assert.equal(
		sanitizeLabelHtml( '<b>Splash</b><br><small>app start</small>' )
	,	'<b>Splash</b><br/><small>app start</small>'
	)
} )

test( 'strips script and event handlers', () => {
	assert.equal( sanitizeLabelHtml( '<script>alert(1)</script>ok' ), 'ok' )
	assert.equal( sanitizeLabelHtml( '<b onclick="alert(1)">x</b>' ), '<b>x</b>' )
	assert.equal( sanitizeLabelHtml( '<img src=x onerror=alert(1)>hi' ), 'hi' )
	assert.equal( sanitizeLabelHtml( '<iframe src="https://evil"></iframe>y' ), 'y' )
} )

test( 'unwraps unknown tags, drops dangerous ones with content', () => {
	assert.equal( sanitizeLabelHtml( '<div><b>a</b></div>' ), '<b>a</b>' )
	assert.equal( sanitizeLabelHtml( '<p>hello</p>' ), 'hello' )
	assert.equal( sanitizeLabelHtml( '<a href="javascript:alert(1)">click</a>' ), '' )
} )

test( 'sanitizeStyle allowlists props and blocks url/expression', () => {
	assert.equal(
		sanitizeStyle( ';display:grid\n;place-items:center\n;font-size:15px' )
	,	'display:grid;place-items:center;font-size:15px'
	)
	assert.equal( sanitizeStyle( 'color:red;position:fixed' ), 'color:red' )
	assert.equal( sanitizeStyle( 'background:url(javascript:alert(1))' ), '' )
	assert.equal( sanitizeStyle( 'font-size:expression(alert(1))' ), '' )
	assert.equal( sanitizeStyle( 'color:red;width:100%;evil:1' ), 'color:red;width:100%' )
} )

test( 'labelContentRisks flags script and handlers', () => {
	assert.deepEqual( labelContentRisks( '<b>ok</b>', '' ), [] )
	assert.ok( labelContentRisks( '<script>alert(1)</script>', '' ).includes( '<script>' ) )
	assert.ok( labelContentRisks( '<b onclick="x">x</b>', '' ).some( _ => _.includes( 'onclick' ) ) )
	assert.ok( labelContentRisks( 'x', 'background:url(evil)' ).length )
	assert.ok(
		modelRiskyLabelNodes( {
			nodes	: [
				[ 'Safe', { html: '<b>a</b>' }, {} ]
			,	[ 'Bad', { html: '<iframe></iframe>', style: '' }, {} ]
			]
		,	links	: []
		} ).some( _ => _.id === 'Bad' )
	)
} )
