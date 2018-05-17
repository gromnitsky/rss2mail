# rss2mail

Convert an rss/atom feed to a bunch of emails in mbox/rnews compatible
output.

* does NOT send the emails
* sendmail ready
* auto deduces output to text/plain or text/html
* sanitized html
* no configs, settings, templates, &c
* < 4KB src

## Setup

node 10.x

    # npm i -g rss2mail

## Usage

Read Spolsky's musings in mutt:

~~~
$ curl https://www.joelonsoftware.com/feed/ | rss2mail > 1.mbox
$ mutt -f 1.mbox
~~~

![mutt](https://ultraimg.com/images/2018/05/17/MvxO.png)

This will create html emails! You have no control around this--if
rss2mail detects plain text in feed articles then it produces
text/plain output.

To convert & send, install procmail pkg that contains
[formail](https://linux.die.net/man/1/formail) util:

    $ curl https://www.joelonsoftware.com/feed/ | rss2mail bob@example.com alice@example.net | formail -s sendmail -it

To change `From` header, use

    $ curl ... | rss2mail -f me@example.com

To post to some `rss.test` newsgroup:

    $ curl https://www.joelonsoftware.com/feed/ | rss2mail --rnews rss.test | sudo -u news rnews -N

## License

MIT
