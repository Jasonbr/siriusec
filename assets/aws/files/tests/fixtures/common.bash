#!/bin/bash
export SIRIUSEC_TEST_MODE=true
export SIRIUSEC_TESTVAR_LOCAL_IP=10.1.2.3
export SIRIUSEC_TESTVAR_LOCAL_HOSTNAME=ip-10-1-2-3.ec2.internal
export SIRIUSEC_TESTVAR_PUBLIC_IP=1.2.3.4

TEST_SUITE="$(basename ${BATS_TEST_FILENAME%%.bats})"

setup_file() {
    load fixtures/test-setup

    # write_confd_file is a function defined to set up fixtures inside each test
    write_confd_file

    # generate config
    run ${BATS_TEST_DIRNAME?}/../bin/siriusec-generate-config
    export GENERATE_EXIT_CODE=$?
    # store all the lines in a given block, stops capturing on newlines
    # any use of the block must be quoted to retain newlines
    export SIRIUSEC_BLOCK=$(awk '/siriusec:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export AUTH_BLOCK=$(awk '/auth_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export PROXY_BLOCK=$(awk '/proxy_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export NODE_BLOCK=$(awk '/ssh_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export KUBE_BLOCK=$(awk '/kubernetes_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export DB_BLOCK=$(awk '/db_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export APP_BLOCK=$(awk '/app_service:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export DB_DATABASES_BLOCK=$(awk '/databases:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
    export APP_APPS_BLOCK=$(awk '/apps:/,/^$/' ${SIRIUSEC_CONFIG_PATH?})
}

teardown_file() {
    load fixtures/test-teardown
}
