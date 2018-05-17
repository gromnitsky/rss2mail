let {Transform} = require('stream')
let os = require('os')
let crypto = require('crypto')

let MimeBuilder = require('emailjs-mime-builder').default

let feed = require('grepfeed/lib/feed')
let gfu = require('grepfeed/lib/u')

class MailStream extends Transform {
    constructor(opts) {
	super()
	this.opts = opts       // f - from, _ - to (arr), rnews (bool)
	this._writableState.objectMode = true // we can eat objects
	this.article_count = 0
	this.trans = opts.rnews ? this.rnews : this.mbox
    }
    _transform(input, encoding, done) {
	let m = new Mail(feed.article(input, ++this.article_count), this.opts)
	this.push(this.trans(m))
	done()
    }
    rnews(mail) {
	mail.mime.setHeader('newsgroups', this.opts._)
	return [`#! rnews ${Buffer.byteLength(mail.toString()) + 1}`,
		mail.toString()].join("\n") + "\n"
    }
    mbox(mail) {
	mail.mime.setHeader('to', this.opts._)
	return [(this.article_count > 1 ? "\n" : "") + mbox_header(mail),
		mbox_escape(mail.toString())].join("\n") + "\n"
    }
}
module.exports = MailStream

class Mail {
    constructor(article, opts) {
	this.article = article
	this.opts = opts
	this.is_html = is_html(article.description)
	this.mime = new MimeBuilder(this.is_html ? 'text/html' : 'text/plain')
	    .setHeader({
		'path': os.hostname(),
		'message-id': this.msgid(),
		'from': this.opts.f || this.article.author || 'rss2mail <rss@example.com>',
		'date': this.article.pubDate,
		'subject': this.article.title || 'no title',
		'content-disposition': 'inline',
		'x-rss2mail-categories': this.article.categories.join(", ")
	    }).setContent([this.permalink(),
			   this.article.description,
			   this.enclosures()].join("\n\n"))
    }

    toString() { return this.mime.build().replace(/\r$/mg, '').trim() }

    // INN barks if message-id header is folded
    msgid() { return `${sha1(this.article)}.rss2mail@example.com` }

    permalink() {
	let url = this.article.link
	return this.is_html ? `<p>Permalink: <a href='${url}'>${url}</a></p>` : `Permalink: ${url}`
    }

    enclosures() {
	if (!this.article.enclosures.length) return ''

	let head = 'Enclosures:';
	if (this.is_html) head = `<hr>\n<p>${head}</p>`

	let html = e => ['<ul>', ...e.map(enc => li(enc.obj)), '</ul>']
	let li = enc => `<li><a href="${enc.url}">${enc.url}</a> (${enc.type} ${gfu.commas(enc.length)})</li>`

	let txt = e => e.map( enc => `* ${enc}`)
	let list = this.is_html ? html : txt
	return [head, list(this.article.enclosures).join("\n")].join("\n\n")
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
