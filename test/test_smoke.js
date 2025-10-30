#!/usr/bin/env -S mocha --ui=tdd

import cp from 'child_process'
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let cli = `${__dirname}/../rss2mail.js`
let datadir = `${__dirname}/data`

suite('Smoke', function() {
    test('almost-empty.xml mbox', function() {
	let r = cp.execSync(`${cli} q@example.com <${datadir}/almost-empty.xml|grep -v '^Path:'`)
	assert.equal(r.toString(), `From rss@example.com Thu Jan 01 00:00:00 1970
Content-Disposition: inline
From: rss@example.com
Subject: no title
Message-ID: <article.df7b466f2490f77a5c523c25.rss2mail@example.com>
Date: Thu, 01 Jan 1970 00:00:00 +0000
To: q@example.com
Content-Transfer-Encoding: 7bit
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Permalink: undefined\n`)
    })

    test('almost-empty.xml rnews', function() {
	let r = cp.execSync(`${cli} --rnews < ${datadir}/almost-empty.xml|head -1`)
	assert.equal(r.toString(), "#! rnews 297\n")
    })

    test('reddit_eli_zaretskii mbox', function() {
	let r = cp.execSync(`${cli} < ${datadir}/reddit_eli_zaretskii.xml | grep '^From '| wc -l`)
	assert.equal(r.toString(), "25\n")
    })

    test('history', function() {
	let db = `tmp.${Math.random().toString(36).substring(7)}.txt`
	let cmd = `${cli} < ${datadir}/cartalk.xml --history ${db} | grep '^From '| wc -l`
	let r = cp.execSync(cmd)
	assert.equal(r.toString(), "2\n")
	cp.execSync(`sed -i'' 1d ${db}`) // delete 1st line in-place
	r = cp.execSync(cmd)
	assert.equal(r.toString(), "1\n")
	r = cp.execSync(cmd)
	assert.equal(r.toString(), "0\n")

	fs.unlinkSync(db)
    })

    test('history invalid file', function() {
        let r = cp.spawnSync(cli, ['--history', '/does_not_exist'], {
            input: fs.readFileSync(`${datadir}/cartalk.xml`)
        })
        assert.equal(r.status, 1)
        assert.equal(r.stderr.toString().trim(), "rss2mail error: EACCES: permission denied, open '/does_not_exist'")
    })
})
