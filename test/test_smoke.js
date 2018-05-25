#!/opt/bin/mocha --ui=tdd
'use strict';

let execSync = require('child_process').execSync
let assert = require('assert').strict
let fs = require('fs')

let cli = `${__dirname}/../rss2mail`
let datadir = `${__dirname}/data`

suite('Smoke', function() {
    test('almost-empty.xml mbox', function() {
	let r = execSync(`${cli} q@example.com <${datadir}/almost-empty.xml|grep -v '^Path:'`)
	assert.equal(r.toString(), `From rss@example.com Thu Jan 01 00:00:00 1970
Content-Type: text/plain
Message-Id: <e630d9f308f062d8d70e2c27efaacac4d9da2f6d.rss2mail@example.com>
From: rss@example.com
Date: Thu, 01 Jan 1970 00:00:00 GMT
Subject: no title
Content-Disposition: inline
To: q@example.com
Content-Transfer-Encoding: 7bit
MIME-Version: 1.0

Permalink: undefined\n`)
    })

    test('almost-empty.xml rnews', function() {
	let r = execSync(`${cli} --rnews < ${datadir}/almost-empty.xml|head -1`)
	assert.equal(r.toString(), "#! rnews 297\n")
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
