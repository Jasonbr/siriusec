#!/bin/bash
set -e

ROLE="${SIRIUSEC_ROLE:-all}"
CONFIG="/etc/siriusec/${ROLE}.yaml"

if [ ! -f "$CONFIG" ]; then
    echo "ERROR: Config file not found: $CONFIG"
    echo "Expected SIRIUSEC_ROLE to be one of: auth, proxy, node"
    exit 1
fi

echo "Starting siriusec with role: ${ROLE}"
exec siriusec start --roles="${ROLE}" -c "$CONFIG" "$@"
