out := _out

all: clean $(patsubst %.xml, %.lol, $(wildcard *.xml))

%.lol: %.xml
	@mkdir -p $(out)
	cat $< | ../../rss2mail.js --history $(out)/history.txt -o $(out)/1.mbox

clean:
	cat .gitignore | xargs rm -rf
