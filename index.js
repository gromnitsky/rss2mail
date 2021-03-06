let {Transform} = require('stream')
let os = require('os')
let crypto = require('crypto')
let readline = require('readline')
let util = require('util')
let fs = require('fs')

let MailComposer = require('nodemailer/lib/mail-composer')
let lockfile = require('lockfile')

let feed = require('grepfeed/lib/feed')
let gfu = require('grepfeed/lib/u')

class MailStream extends Transform {
    constructor(opts) {
	super()
	this.opts = opts       // f - from, _ - to (arr), rnews (bool)
	this._writableState.objectMode = true // we can eat objects
	this.article_count = 0
	this.trans = opts.rnews ? this.rnews : this.mbox
	this.history = new History(opts.history)
    }
    async _transform(input, encoding, done) {
	++this.article_count
	this._meta = this._meta || feed.metadata(input.meta)
	let m = new Mail(feed.article(input, undefined, this._meta), this.opts)
	if (!await this.history.exists(m.msgid())) {
	    this.push(await this.trans(m))
	    await this.history.add(m.msgid())
	    return done()
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
module.exports = MailStream

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

	let html = e => ['<ul>', ...e.map(enc => li(enc.obj)), '</ul>']
	let li = enc => `<li><a href="${enc.url}">${enc.url}</a> (${enc.type} ${gfu.commas(enc.length)})</li>`

	let txt = e => e.map( enc => `* ${enc}`)
	let list = this.is_html ? html : txt
	return [head, list(this.article.enclosures).join("\n")].join("\n\n")
    }
}

let fappend = util.promisify(fs.appendFile)
let flock = util.promisify(lockfile.lock)
let funlock = util.promisify(lockfile.unlock)

class History {
    constructor(db) {
	this.db = db
	this.lock = db + '.lock'
    }
    async add(msgid) {
	if (!this.db) return
	await flock(this.lock, {wait: 5000})
	await fappend(this.db, msgid + "\n")
	return await funlock(this.lock)
    }
    exists(msgid) {  // it's 1 line in bash, but all this rubbish in node
	return new Promise( resolve => {
	    if (!this.db) { resolve(false); return }

	    let input = fs.createReadStream(this.db)
	    input.on('error', () => resolve(false))

	    let rl = readline.createInterface({ input })
	    let found = false
	    rl.on('close', () => resolve(found))
	    rl.on('line', line => {
	    	if (line === msgid) {
		    found = true
		    rl.close()
		}
	    })
	})
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
