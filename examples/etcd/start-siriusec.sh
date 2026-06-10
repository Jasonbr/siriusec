#!/bin/bash
#
# Example of how Siriusec must be started to connect to etcd
HERE=$(readlink -f $0)
cd "$(dirname $HERE)" || exit

siriusec start -c siriusec.yaml -d
