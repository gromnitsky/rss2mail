import {Transform} from 'stream'
import os from 'os'
import crypto from 'crypto'
import fs from 'fs/promises'

import MailComposer from 'nodemailer/lib/mail-composer/index.js'

import * as feed from 'grepfeed/lib/feed.js'
import * as gfu from 'grepfeed/lib/u.js'

export default class MailStream extends Transform {
    constructor(opts) {
	super()
	this.opts = opts       // f - from, _ - to (arr), rnews (bool)
	this._writableState.objectMode = true // we can eat objects
	this.article_count = 0
	this.trans = opts.rnews ? this.rnews : this.mbox
        this.history = opts.history ? new History(opts.history) : null
    }
    async _transform(input, encoding, done) {
	++this.article_count
	this._meta = this._meta || feed.metadata(input.meta)
	let m = new Mail(feed.article(input, undefined, this._meta), this.opts)
        if (this.history) {
            if (await this.history.add(m.msgid()))
                this.push(await this.trans(m))
        } else {
            this.push(await this.trans(m))
        }
        done()
    }
    async rnews(mail) {
        // `nodemailer/lib/mime-node` api is unfortunate
        mail.mime.setHeader('newsgroups', this.opts._.join`,`)
        let str = await mail.to_s()
        return [`#! rnews ${Buffer.byteLength(str) + 1}`, str].join("\n") + "\n"
    }
    async mbox(mail) {
	mail.mime.setHeader('to', this.opts._)
        return [(this.article_count > 1 ? "\n" : "") + mbox_header(mail),
                mbox_escape(await mail.to_s())].join("\n") + "\n"
    }
}

class Mail {
    constructor(article, opts) {
	this.article = article
	this.opts = opts
	this.is_html = is_html(article.description)
        this.mime = new MailComposer({
            messageId: this.msgid(),
            from: this.opts.f || this.article.author,
            date: this.article.pubDate,
            subject: this.article.title || 'no title',
            [this.is_html ? 'html' : 'text']: [this.permalink(),
                                          this.article.description,
                                          this.enclosures()].join("\n\n"),
            headers: {
                'content-disposition': 'inline',
                'path': os.hostname(),
                'x-rss2mail-categories': this.article.categories.join(", "),
            },
        }).compile()
    }

    async to_s() {
        return (await this.mime.build()).toString().replace(/\r$/mg, '').trim()
    }

    // INN barks if message-id header is folded
    msgid() { return this._msgid = this._msgid || `${sha1(this.article)}.rss2mail@example.com` }

    permalink() {
	let url = this.article.link
	return this.is_html ? `<p>Permalink: <a href='${url}'>${url}</a></p>` : `Permalink: ${url}`
    }

    enclosures() {
	if (!this.article.enclosures.length) return ''

	let head = 'Enclosures:';
	if (this.is_html) head = `<hr>\n<p>${head}</p>`

        let html = e => ['<ul>', ...e.map(enc => li(enc)), '</ul>']
	let li = enc => `<li><a href="${enc.url}">${enc.url}</a> (${enc.type} ${gfu.commas(enc.length)})</li>`

	let txt = e => e.map( enc => `* ${enc}`)
	let list = this.is_html ? html : txt
	return [head, list(this.article.enclosures).join("\n")].join("\n\n")
    }
}

class History {
    constructor(filename) {
        this.fd = fs.open(filename, "a+")
        this.fda = fs.open(filename, "a")
    }
    async add(msgid) {
        let fda = await this.fda
        if (!await this.exists(msgid)) {
            fda.writeFile(msgid + "\n")
            return true
        }
    }
    async exists(msgid) {
        let fd = await this.fd
        for await (const line of fd.readLines({autoClose: false, start: 0})) {
            if (line === msgid) return true
        }
    }
}

function mbox_escape(s) { return s.replace(/^From .+/mg, '>$&') }

function mbox_header(mail) {
    let d = mail.article.pubDate
    let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
		  'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let pad = (str) => ('0'+str).slice(-2)
    return [
	'From rss@example.com',
	days[d.getUTCDay()],
	months[d.getUTCMonth()],
	pad(d.getUTCDate()),
	[
	    pad(d.getUTCHours()),
	    pad(d.getUTCMinutes()),
	    pad(d.getUTCSeconds())
	].join(':'),
	d.getUTCFullYear()
    ].join(' ')
}

function sha1(obj) {
    return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex')
}

// FIXME: use parse5 to strip non-text nodes, then return s === strip(s)
function is_html(s) { return /\/[a-z]*>/i.test(s) }
