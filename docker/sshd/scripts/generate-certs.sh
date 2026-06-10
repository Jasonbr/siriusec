#!/bin/bash
set -x

TCTL="/usr/local/bin/tctl --auth-server=proxy.luna.siriusec:3025"
cd /mnt/shared/certs || exit 1

generate_certs() {
    $TCTL auth export --type=user | sed s/cert-authority\ // > ./siriusec.pub || return
    $TCTL auth export --type=host | sed s/*.siriusec/luna.siriusec,*.luna.siriusec,*.openssh.siriusec/ > ./siriusec-known_hosts.pub || return
    $TCTL create -f /etc/siriusec.d/scripts/resources.yaml || return
    $TCTL auth sign --user=bot --format=openssh --out=bot --overwrite --ttl=10h || return
    $TCTL auth sign --user=bot --format=file --out=bot.pem --overwrite --ttl=10h || return
    $TCTL auth sign --user=editor --format=file --out=editor.pem --overwrite --ttl=10h || return
    $TCTL auth sign --host=mars.openssh.siriusec --format=openssh --overwrite --out=mars.openssh.siriusec || return
}

while true
do
    if generate_certs; then echo "Generated certs, exiting"; exit 0; fi;
    echo "Failed to generate certs, retry in a second";
    sleep 1;
done
