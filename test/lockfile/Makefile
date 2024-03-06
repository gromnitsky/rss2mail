webpath := http://127.0.0.1/~alex/lib/software/alex/rss2mail/test/lockfile

all: clean rss.ini
	gmakerss j=$(or $(j),8)

%.ini: %.erb
	erb webpath=$(webpath) $< > $@

clean:
	cat .gitignore | xargs rm -rf
