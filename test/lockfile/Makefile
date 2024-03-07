out := _out
dup := 100

all: $(patsubst %.xml, %.lol, $(wildcard *.xml $(out)/*.xml))

include $(out)/$(dup).mk

%.lol: %.xml
	RSS2MAIL=$< ../../rss2mail.js --history $(out)/history.txt -o $(out)/1.mbox < $<

%.mk:
	cat .gitignore | xargs rm -rf
	@mkdir -p $(dir $@)
	seq 1 $(notdir $(basename $@)) | xargs -I@ cp petercooper.xml $(out)/@.xml
	seq 1 $(notdir $(basename $@)) | xargs -I@ echo $(out)/@.lol: >> $@
