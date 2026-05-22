# The base image (buildbox:latest) is built by running `make -C build.assets`
# from the base repo directory $GOPATH/siriusec.com/siriusec
FROM quay.io/siriusec/siriusec-buildbox:go1.15.5

# DEBUG=1 is needed for the Web UI to be loaded from static assets instead
# of the binary
ENV DEBUG=1 GOPATH=/root/go PATH=$PATH:/root/go/src/github.com/siriusec/siriusec/build:/root/go/bin

# htop is useful for testing terminal resizing
RUN apt-get update && \
    apt-get install -y htop vim screen && \
    mkdir -p /root/go/src/github.com/siriusec/siriusec

# allows ansible and ssh testing
RUN apt-get install -y ansible ssh inetutils-syslogd

RUN mkdir /run/sshd

VOLUME ["/siriusec", "/var/lib/siriusec"]
COPY ./sshd/bashrc /root/.bashrc
COPY ./sshd/screenrc /root/.screenrc
COPY ./sshd/scripts/start-sshd.sh /usr/bin/start-sshd.sh

# expose only proxy ports (SSH and HTTPS)
EXPOSE 3023 3080
