//  Analytics is optional: local development and privacy-blocking browsers simply
//  do not define gtag. Keep product events free of diagram, prompt, and key data.
export const
track = event => {
	try {
		globalThis.gtag?.( 'event', event )
	} catch {
		//  Measurement must never interrupt an editor action.
	}
}
