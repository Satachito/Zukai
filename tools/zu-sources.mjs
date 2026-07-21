//	Extract model.meta.sources ( e.g. Terraform HCL ) from a .zu file to disk.
//
//	usage: node tools/zu-sources.mjs <file.zu> [outDir]

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { parseZuText } from './zu-validate.mjs'

const
[ , , zuPath, outDir = '.' ] = process.argv

if	( !zuPath ) {
	console.error( 'usage: node tools/zu-sources.mjs <file.zu> [outDir]' )
	process.exit( 1 )
}

const
{ model } = parseZuText( await readFile( zuPath, 'utf8' ) )
,	sources = model.meta?.sources

if	( !sources || !Object.keys( sources ).length ) {
	console.error( `${ zuPath }: no model.meta.sources` )
	process.exit( 1 )
}

const
base = resolve( outDir )

for	( const [ name, text ] of Object.entries( sources ) ) {
	//	filenames come from file content — refuse anything escaping outDir
	const
	abs = resolve( base, name )
	if	( abs === base || !abs.startsWith( base + sep ) ) throw new Error( `unsafe source filename: ${ name }` )
	await mkdir( dirname( abs ), { recursive: true } )
	await writeFile( abs, text, 'utf8' )
	console.log( `${ abs } ( ${ text.length } chars )` )
}
