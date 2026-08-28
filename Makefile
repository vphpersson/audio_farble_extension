NAME:=audio_farble
XPI:=dist/$(NAME).xpi
SALT:=salt.txt
.PHONY: build clean
build: $(XPI)
$(SALT):
	openssl rand -hex 16 > $@
$(XPI): manifest.json inject.js $(SALT)
	rm -rf build; mkdir -p build dist
	cp manifest.json build/
	sed "s/__SALT__/$$(cat $(SALT))/" inject.js > build/inject.js
	cd build && zip -q -r -FS ../$(XPI) . -x '.*'
	@echo built $(XPI)
clean:
	rm -rf build dist
