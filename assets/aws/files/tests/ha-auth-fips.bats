write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=auth
EC2_REGION=us-east-1
SIRIUSEC_AUTH_TYPE=saml
SIRIUSEC_AUTH_SERVER_LB=gus-tftestkube4-auth-0f66dd17f8dd9825.elb.us-east-1.amazonaws.com
SIRIUSEC_CLUSTER_NAME=gus-tftestkube4
SIRIUSEC_DOMAIN_ADMIN_EMAIL=test@email.com
SIRIUSEC_DOMAIN_NAME=gus-tftestkube4.siriusec.io
SIRIUSEC_DYNAMO_TABLE_NAME=gus-tftestkube4
SIRIUSEC_DYNAMO_EVENTS_TABLE_NAME=gus-tftestkube4-events
SIRIUSEC_INFLUXDB_ADDRESS=http://gus-tftestkube4-monitor-ae7983980c3419ab.elb.us-east-1.amazonaws.com:8086
SIRIUSEC_LICENSE_PATH=/home/gus/downloads/siriusec/license-gus.pem
SIRIUSEC_LOCKS_TABLE_NAME=gus-tftestkube4-locks
SIRIUSEC_S3_BUCKET=gus-tftestkube4.siriusec.io
USE_ACM=false
EOF
    export SIRIUSEC_TEST_FIPS_MODE=true
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

# in each test, we echo the block so that if the test fails, the block is outputted
@test "[${TEST_SUITE?}] siriusec.storage.type is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${SIRIUSEC_BLOCK?}"
    echo "${SIRIUSEC_BLOCK?}" | grep -E "^    type: dynamodb"
}

@test "[${TEST_SUITE?}] siriusec.storage.region is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${SIRIUSEC_BLOCK?}"
    echo "${SIRIUSEC_BLOCK?}" | grep -E "^    region: ${EC2_REGION?}"
}

@test "[${TEST_SUITE?}] siriusec.storage.table_name is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${SIRIUSEC_BLOCK?}"
    echo "${SIRIUSEC_BLOCK?}" | grep -E "^    table_name: ${SIRIUSEC_DYNAMO_TABLE_NAME?}"
}

@test "[${TEST_SUITE?}] siriusec.storage.audit_events_uri is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${SIRIUSEC_BLOCK?}"
    echo "${SIRIUSEC_BLOCK?}" | grep -E "^    audit_events_uri: dynamodb://${SIRIUSEC_DYNAMO_EVENTS_TABLE_NAME?}"
}

@test "[${TEST_SUITE?}] auth_service.public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  public_addr:" ${SIRIUSEC_CONFIG_PATH?} | grep -q "${SIRIUSEC_AUTH_SERVER_LB?}:3025"
}

@test "[${TEST_SUITE?}] auth_service.cluster_name is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  cluster_name:" | grep -q "${SIRIUSEC_CLUSTER_NAME?}"
}

@test "[${TEST_SUITE?}] auth_service.listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  listen_addr:" | grep -q "0.0.0.0:3025"
}

@test "[${TEST_SUITE?}] auth_service.local_auth is false in FIPS mode" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  authentication:" -A2 | grep -q "local_auth: false"
}

@test "[${TEST_SUITE?}] auth_service.authentication.type is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^    type:" | grep -q "saml"
}
