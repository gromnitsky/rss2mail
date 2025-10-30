#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'
import FeedParser from 'feedparser'
import MailStream from './index.js'
import meta from './package.json' with { type: 'json' }

function errx(e) {
    console.error(meta.name, 'error:', e.message)
    process.exit(1)
}

let args; try {
    args = util.parseArgs({allowPositionals: true, options: {
        rnews: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        history: { type: 'string' }, f: { type: 'string' },
        o: { type: 'string' }, V: { type: 'boolean' }
    }})
} catch (err) {
    errx(err)
}
if (args.values.help) {
    console.log(fs.readFileSync(import.meta.dirname + '/usage.txt').toString().trim())
    process.exit(0)
}
if (args.values.V) { console.log(meta.version); process.exit(0) }

let streams = [process.stdin, new FeedParser(), new MailStream(args)]
let out = process.stdout
if (args.values.o) {
    out = fs.createWriteStream(args.values.o, {flags: 'a'})
    out.on('error', errx)
}
streams.push(out)

pipeline(...streams, err => {
    if (err && err.code !== 'EPIPE') errx(err)
})
