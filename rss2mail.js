#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'

import FeedParser from 'feedparser'
import minimist from 'minimist'

import MailStream from './index.js'

let errx = function(is_exit, e) {
    console.error('rss2mail error:', e.message)
    if (is_exit) process.exit(1)
}
let log = util.debuglog('rss2mail')
let argv = minimist(process.argv.slice(2), {
    boolean: ['rnews'],
    string: ['f', 'history', 'o']
})
let streams = [process.stdin, new FeedParser(), new MailStream(argv)]
if (!argv.o) streams.push(process.stdout)
let pipe = pipeline(...streams, err => {
    if (err && err.code !== 'EPIPE') {
	errx(false, err)
	log(err)		// NODE_DEBUG=rss2mail
	process.exitCode = 1
    }
})

if (argv.o) {
    pipe.on('data', chunk => {
	let out = fs.createWriteStream(argv.o, {flags: 'a'})
	out.on('error', err => errx(1, err))
	out.write(chunk)
    })
}
