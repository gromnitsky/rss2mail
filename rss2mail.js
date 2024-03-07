#!/usr/bin/env node

import {pipeline} from 'stream'
import util from 'util'
import fs from 'fs'
import {fileURLToPath} from 'url'
import path from 'path'
import FeedParser from 'feedparser'
import lockfile from 'proper-lockfile'
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
let out = process.stdout
let lock = Promise.resolve( () => {/* nop */})
if (args.values.o) {
    out = fs.createWriteStream(args.values.o, {flags: 'a'})
    lock = lockfile.lock(args.values.o, {retries: {retries: 10, randomize: true}})
}
streams.push(out)

lock.then( unlock => {
    pipeline(...streams, err => {
        if (err && err.code !== 'EPIPE') errx(err)
        unlock()
    })
}).catch(errx)
