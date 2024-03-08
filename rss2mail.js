#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'
import path from 'path'
import FeedParser from 'feedparser'
import lockfile from 'proper-lockfile'
import MailStream from './index.js'

function errx(e) {
    console.error(`rss2mail error (${process.env.RSS2MAIL || process.pid}):`, e.message)
    process.exit(1)
}
let __dirname = path.dirname(new URL('', import.meta.url).pathname)

let args
try {
    args = util.parseArgs({allowPositionals: true, options: {
        rnews: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        history: { type: 'string' }, f: { type: 'string' },
        o: { type: 'string' }, 'no-lock': { type: 'boolean' }
    }})
} catch (err) {
    errx(err)
}
if (args.values.help) {
    process.stdout.write(fs.readFileSync(__dirname + '/usage.txt').toString())
    process.exit(0)
}

let streams = [process.stdin, new FeedParser(), new MailStream(args)]
let out = process.stdout
let lock = Promise.resolve( () => {/* nop */})
if (args.values.o) {
    out = fs.createWriteStream(args.values.o, {flags: 'a'})
    out.on('error', errx)
    if (!args.values['no-lock']) {
        lock = lockfile.lock(args.values.o, {
            retries: { // living dangerously
                retries: 0, forever: true, minTimeout: 10, maxTimeout: 100,
                randomize: true
            }
        })
    }
}
streams.push(out)

lock.then( unlock => {
    pipeline(...streams, err => {
        if (err && err.code !== 'EPIPE') errx(err)
        unlock()
    })
}).catch(errx)
