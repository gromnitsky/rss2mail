#!/usr/bin/env -S mocha --ui=tdd

import {execSync} from 'child_process'
import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let cli = `${__dirname}/../rss2mail.js`
let datadir = `${__dirname}/data`

suite('Smoke', function() {
    test('almost-empty.xml mbox', function() {
	let r = execSync(`${cli} q@example.com <${datadir}/almost-empty.xml|grep -v '^Path:'`)
	assert.equal(r.toString(), `From rss@example.com Thu Jan 01 00:00:00 1970
Content-Type: text/plain; charset=utf-8
Content-Disposition: inline
From: rss@example.com
Subject: no title
Message-ID: <df7b466f2490f77a5c523c25c9a9b178ff278824.rss2mail@example.com>
Date: Thu, 01 Jan 1970 00:00:00 +0000
To: q@example.com
Content-Transfer-Encoding: 7bit
MIME-Version: 1.0

Permalink: undefined\n`)
    })

    test('almost-empty.xml rnews', function() {
	let r = execSync(`${cli} --rnews < ${datadir}/almost-empty.xml|head -1`)
	assert.equal(r.toString(), "#! rnews 305\n")
    })

    test('reddit_eli_zaretskii mbox', function() {
	let r = execSync(`${cli} < ${datadir}/reddit_eli_zaretskii.xml | grep '^From '| wc -l`)
	assert.equal(r.toString(), "25\n")
    })

    test('history', function() {
	let db = `tmp.${Math.random().toString(36).substring(7)}.txt`
	let cmd = `${cli} < ${datadir}/cartalk.xml --history ${db} | grep '^From '| wc -l`
	let r = execSync(cmd)
	assert.equal(r.toString(), "2\n")
	execSync(`sed -i'' 1d ${db}`) // delete 1st line in-place
	r = execSync(cmd)
	assert.equal(r.toString(), "1\n")
	r = execSync(cmd)
	assert.equal(r.toString(), "0\n")

	fs.unlinkSync(db)
    })
})
