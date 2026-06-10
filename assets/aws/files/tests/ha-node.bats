write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=node
EC2_REGION=us-west-2
SIRIUSEC_AUTH_SERVER_LB=gus-tftestkube4-auth-0f66dd17f8dd9825.elb.us-east-1.amazonaws.com
SIRIUSEC_CLUSTER_NAME=gus-tftestkube4
SIRIUSEC_INFLUXDB_ADDRESS=http://gus-tftestkube4-monitor-ae7983980c3419ab.elb.us-east-1.amazonaws.com:8086
USE_ACM=false
EOF
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

@test "[${TEST_SUITE?}] siriusec.auth_servers is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    cat "${SIRIUSEC_CONFIG_PATH?}" | grep -E "^  auth_servers:" -A1 | grep -q "${SIRIUSEC_AUTH_SERVER_LB?}"
}

# in each test, we echo the block so that if the test fails, the block is outputted
@test "[${TEST_SUITE?}] ssh_service.listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${NODE_BLOCK?}"
    echo "${NODE_BLOCK?}" | grep -E "^  listen_addr: " | grep -q "0.0.0.0:3022"
}
