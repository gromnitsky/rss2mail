let {Transform} = require('stream')
let os = require('os')
let crypto = require('crypto')

let MimeBuilder = require('emailjs-mime-builder').default

let feed = require('grepfeed/lib/feed')
let gfu = require('grepfeed/lib/u')

class MailStream extends Transform {
    constructor(opts) {
	super()
	this.opts = opts
	this._writableState.objectMode = true // we can eat objects
    }
    _transform(input, encoding, done) {
	let m = new Mail(feed.article(input), this.opts)
	this.push(this.header(m) + m + "\n")
	done()
    }
    header(mail) {
	return "-------------\n"
    }
}
module.exports = MailStream

class Mail {
    constructor(article, opts) {
	this.article = article
	this.opts = opts       // f - from, _ - to (arr), rnews (bool)
	this.is_html = is_html(article.description)
    }

    toString() {
	return new MimeBuilder(this.is_html ? 'text/html' : 'text/plain')
	    .setHeader({
		[this.opts.rnews ? 'newsgroups' : 'to']: this.opts._,
		'message-id': this.msgid(),
		'from': this.opts.f || this.article.author,
		'date': this.article.pubDate,
		'subject': this.article.title,
		'content-disposition': 'inline',
		'x-rss2mail-categories': this.article.categories.join(", ")
	    }).setContent([this.permalink(),
			   this.article.description,
			   this.enclosures()].join("\n\n"))
	    .build()
    }

    msgid() { return `${sha1(this.article)}.rss2mail@${os.hostname()}` }

    permalink() {
	let text = `Permalink: ${this.article.link}`
	return this.is_html ? `<p>${text}</p>` : text
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

function sha1(obj) {
    return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex')
}

// FIXME: use parse5 to strip non-text nodes, then return s === strip(s)
function is_html(s) { return /\/[a-z]*>/i.test(s) }
