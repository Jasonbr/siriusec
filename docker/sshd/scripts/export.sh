#!/bin/bash

while true
do
    tctl auth export --type=user | sed s/cert-authority\ // > /mnt/shared/certs/siriusec.pub
    sleep 10
done
