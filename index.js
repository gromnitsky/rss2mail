import {Transform} from 'stream'
import os from 'os'
import crypto from 'crypto'
import fs from 'fs/promises'

import MailComposer from 'nodemailer/lib/mail-composer/index.js'

import * as feed from 'grepfeed/lib/feed.js'
import * as gfu from 'grepfeed/lib/u.js'

export default class MailStream extends Transform {
    constructor(opts /* util.parseArgs */) {
	super()
        // values.f - from, values.rnews (bool), positionals - to (arr)
        this.opts = opts
	this._writableState.objectMode = true // we can eat objects
	this.article_count = 0
        this.trans = opts.values.rnews ? this.rnews : this.mbox
        this.history = opts.values.history ? new History(opts.values.history) : null
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
        mail.mime.setHeader('newsgroups', this.opts.positionals.join`,`)
        let str = await mail.to_s()
        return [`#! rnews ${Buffer.byteLength(str) + 1}`, str].join("\n") + "\n"
    }
    async mbox(mail) {
        mail.mime.setHeader('to', this.opts.positionals)
        return [(this.article_count > 1 ? "\n" : "") + mbox_header(mail),
                mbox_escape(await mail.to_s())].join("\n") + "\n"
    }
}

class Mail {
    constructor(article, opts /* util.parseArgs */) {
	this.article = article
	this.is_html = is_html(article.description)
        this.mime = new MailComposer({
            messageId: this.msgid(),
            from: opts.values.f || this.article.author,
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
    msgid() {
        let guid = this.article.guid || JSON.stringify(this.article)
        let prefix = this.article.guid ? 'guid' : 'article'
        let h = crypto.createHash('sha1').update(guid).digest('hex').slice(0,24)
        return [prefix, h, 'rss2mail@example.com'].join`.`
    }

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

// FIXME: use parse5 to strip non-text nodes, then return s === strip(s)
function is_html(s) { return /\/[a-z]*>/i.test(s) }
