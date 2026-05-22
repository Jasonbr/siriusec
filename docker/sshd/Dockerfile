ARG TELEPORT_TAG
FROM quay.io/siriusec/siriusec:${TELEPORT_TAG}

# Demo ansible, ssh, htop
RUN apt-get update && apt-get install -y ansible ssh inetutils-syslogd htop

RUN mkdir /run/sshd

VOLUME ["/siriusec", "/var/lib/siriusec"]

COPY ./etc/siriusec.yaml /etc/siriusec.d/siriusec.yaml
COPY ./.bashrc /root/.bashrc
COPY ./.screenrc /root/.screenrc
COPY ./scripts /etc/siriusec.d/scripts
COPY ./ansible /etc/siriusec.d/ansible
COPY ./pam.d/ssh /etc/pam.d/ssh
COPY ./etc/ssh/sshd_config /etc/ssh/sshd_config
