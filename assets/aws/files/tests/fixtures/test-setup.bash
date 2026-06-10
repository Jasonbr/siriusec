#!/bin/bash
export SIRIUSEC_CONFIG_PATH=$(mktemp -t siriusec-generate-configXXXXXXXX)
export SIRIUSEC_CONFD_DIR=$(mktemp -d -t siriusec.conf.dXXXXXXXX)
