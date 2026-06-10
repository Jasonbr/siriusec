UNAME := $(shell uname -s)

# PAM_POLICY_PATH is where the PAM policy for PAM-aware applications is
# defined.
PAM_POLICY_PATH = /etc/pam.d/

PAM_MODULE_PATH_ESCAPED = $(shell pwd | sed 's/\//\\\//g')

# LD and LD_FLAGS controls the linker and linker flags to use and are
# determined by the OS.
LD = ld
LD_FLAGS = -lpam --shared -x
ifeq ($(UNAME),Darwin)
    LD = clang
    LD_FLAGS = -lpam -shared
endif

all: pam_siriusec.so

install: pam_siriusec.so
	# Copy all PAM policy files over to /etc/pam.d
	for file in $(shell ls policy/); do \
		# Replace the module path in these files with the absolute path to \
		# pam_siriusec.so in current directory. That way we don't depend on the \
		# OS-specific PAM module locations. \
		sh -c "sed 's/pam_siriusec.so/$(PAM_MODULE_PATH_ESCAPED)\/pam_siriusec.so/' policy/$${file} >$(PAM_POLICY_PATH)$${file}"; \
	done

pam_siriusec.so: pam_siriusec.o
	$(LD) $(LD_FLAGS) -o pam_siriusec.so pam_siriusec.o
	chmod 644 pam_siriusec.so

pam_siriusec.o: clean pam_siriusec.c
	gcc -fPIC -c pam_siriusec.c

clean:
	rm -f pam_siriusec.o pam_siriusec.so
