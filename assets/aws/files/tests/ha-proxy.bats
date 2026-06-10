write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=proxy
EC2_REGION=us-west-2
SIRIUSEC_AUTH_SERVER_LB=gus-tftestkube4-auth-0f66dd17f8dd9825.elb.us-east-1.amazonaws.com
SIRIUSEC_CLUSTER_NAME=gus-tftestkube4
SIRIUSEC_DOMAIN_NAME=gus-tftestkube4.siriusec.io
SIRIUSEC_INFLUXDB_ADDRESS=http://gus-tftestkube4-monitor-ae7983980c3419ab.elb.us-east-1.amazonaws.com:8086
SIRIUSEC_PROXY_SERVER_LB=gus-tftestkube4-proxy-bc9ba568645c3d80.elb.us-east-1.amazonaws.com
SIRIUSEC_PROXY_SERVER_NLB_ALIAS=""
SIRIUSEC_S3_BUCKET=gus-tftestkube4.siriusec.io
USE_ACM=false
EOF
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

@test "[${TEST_SUITE?}] siriusec.auth_servers is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    cat "${SIRIUSEC_CONFIG_PATH?}"
    cat "${SIRIUSEC_CONFIG_PATH?}" | grep -E "^  auth_servers:" -A1 | grep -q "${SIRIUSEC_AUTH_SERVER_LB?}"
}

# in each test, we echo the block so that if the test fails, the block is outputted
@test "[${TEST_SUITE?}] proxy_service.public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  public_addr:" ${SIRIUSEC_CONFIG_PATH?} | grep -q "${SIRIUSEC_DOMAIN_NAME?}:443"
}

@test "[${TEST_SUITE?}] proxy_service.ssh_public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  ssh_public_addr:" | grep -q "${SIRIUSEC_DOMAIN_NAME?}:3023"
}

@test "[${TEST_SUITE?}] proxy_service.tunnel_public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  tunnel_public_addr:" | grep -q "${SIRIUSEC_DOMAIN_NAME?}:443"
}

@test "[${TEST_SUITE?}] proxy_service.listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  listen_addr: " | grep -q "0.0.0.0:3023"
}

@test "[${TEST_SUITE?}] proxy_service.tunnel_listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  tunnel_listen_addr: " | grep -q "0.0.0.0:3080"
}

@test "[${TEST_SUITE?}] proxy_service.web_listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  web_listen_addr: " | grep -q "0.0.0.0:3080"
}

@test "[${TEST_SUITE?}] proxy_service.kubernetes.public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  kubernetes:" -A3 | grep -E "^    public_addr" | grep -q "['${SIRIUSEC_DOMAIN_NAME?}:3026']"
}
