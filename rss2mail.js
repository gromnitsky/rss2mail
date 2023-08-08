#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import FeedParser from 'feedparser'
import lockfile from 'lockfile'
import MailStream from './index.js'

let errx = function(e) {
    console.error('rss2mail error:', e.message)
    process.exit(1)
}
let __dirname = path.dirname(fileURLToPath(import.meta.url))

let args
try {
    args = util.parseArgs({allowPositionals: true, options: {
        rnews: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        history: { type: 'string' }, f: { type: 'string' },
        o: { type: 'string' },
    }})
} catch (err) {
    errx(err)
}
if (args.values.help) {
    process.stdout.write(fs.readFileSync(__dirname + '/usage.txt').toString())
    process.exit(0)
}

let streams = [process.stdin, new FeedParser(), new MailStream(args)]
if (!args.values.o) streams.push(process.stdout)
let pipe = pipeline(...streams, err => {
    if (err && err.code !== 'EPIPE') errx(err)
})
if (args.values.o) {
    pipe.on('data', chunk => {
        let out = fs.createWriteStream(args.values.o, {flags: 'a'})
        out.on('error', errx)
	out.cork()
	out.write(chunk)	// to memory

        // we need locking for `chunk` may be > PIPE_BUF (4K on Linux)
        let lock = args.values.o + '.lock'
        lockfile.lock(lock, {wait: 5000}, err => {
            if (err) errx(err)
	    out.uncork()	// puts!
	    lockfile.unlock(lock, err => {
                if (err) errx(err)
		out.end()	// flush, close
	    })
	})
    })
}
