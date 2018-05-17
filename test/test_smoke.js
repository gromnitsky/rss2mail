#!/opt/bin/mocha --ui=tdd
'use strict';

let execSync = require('child_process').execSync
let assert = require('assert').strict

let cli = `${__dirname}/../rss2mail`
let datadir = `${__dirname}/data`

suite('Smoke', function() {
    test('almost-empty.xml mbox', function() {
	let r = execSync(`${cli} q@example.com <${datadir}/almost-empty.xml|grep -v '^Path:'`)
	assert.equal(r.toString(), `From rss@example.com Thu Jan 01 00:00:00 1970
Content-Type: text/plain
Message-Id: <bf9077ec5cf7c10f715cf8a2e5245445ae5b363a.rss2mail@example.com>
From: rss2mail <rss@example.com>
Date: Thu, 01 Jan 1970 00:00:00 GMT
Subject: no title
Content-Disposition: inline
To: q@example.com
Content-Transfer-Encoding: 7bit
MIME-Version: 1.0

Permalink: null\n`)
    })

    test('almost-empty.xml rnews', function() {
	let r = execSync(`${cli} --rnews < ${datadir}/almost-empty.xml|head -1`)
	assert.equal(r.toString(), "#! rnews 303\n")
    })

    test('reddit_eli_zaretskii mbox', function() {
	let r = execSync(`${cli} < ${datadir}/reddit_eli_zaretskii.xml | grep '^From '| wc -l`)
	assert.equal(r.toString(), "25\n")
    })
})
