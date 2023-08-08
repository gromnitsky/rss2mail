#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'
import FeedParser from 'feedparser'
import lockfile from 'lockfile'
import MailStream from './index.js'

let errx = function(is_exit, e) {
    console.error('rss2mail error:', e.message)
    if (is_exit) process.exit(1)
}
let log = util.debuglog('rss2mail')

let args
try {
    args = util.parseArgs({allowPositionals: true, options: {
        rnews: { type: 'boolean' },
        history: { type: 'string' }, f: { type: 'string' },
        o: { type: 'string' },
    }})
} catch (err) {
    errx(1, err)
}
let streams = [process.stdin, new FeedParser(), new MailStream(args)]
if (!args.values.o) streams.push(process.stdout)
let pipe = pipeline(...streams, err => {
    if (err && err.code !== 'EPIPE') {
	errx(false, err)
	log(err)		// NODE_DEBUG=rss2mail
	process.exitCode = 1
    }
})

if (args.values.o) {
    pipe.on('data', chunk => {
        let out = fs.createWriteStream(args.values.o, {flags: 'a'})
        out.on('error', err => errx(1, err))
	out.cork()
	out.write(chunk)	// to memory

        // we need locking for `chunk` may be > PIPE_BUF (4K on Linux)
        let lock = args.values.o + '.lock'
        lockfile.lock(lock, {wait: 5000}, err => {
	    if (err) errx(1, err)
	    out.uncork()	// puts!
	    lockfile.unlock(lock, err => {
		if (err) errx(1, err)
		out.end()	// flush, close
	    })
	})
    })
}
