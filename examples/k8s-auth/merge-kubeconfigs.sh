#!/bin/bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Please specify at least one kubeconfig file."
    exit 1
fi

# Join script arguments with a ":" using bash magic.
IFS=":"
export KUBECONFIG="$*"

# When $KUBECONFIG contains a list of files, kubectl will merge them.
kubectl config view --raw >merged-kubeconfig

echo "Wrote merged-kubeconfig.

Copy the generated kubeconfig file to your Siriusec Proxy server, and set the
kubeconfig_file parameter in your siriusec.yaml config file to point to this
kubeconfig file."
