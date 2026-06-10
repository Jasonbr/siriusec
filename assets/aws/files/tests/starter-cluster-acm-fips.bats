write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=auth,node,proxy
EC2_REGION=us-west-2
SIRIUSEC_AUTH_TYPE=oidc
SIRIUSEC_AUTH_SERVER_LB=localhost
SIRIUSEC_CLUSTER_NAME=gus-startercluster
SIRIUSEC_DOMAIN_ADMIN_EMAIL=email@example.com
SIRIUSEC_DOMAIN_NAME=gus-startercluster.siriusec.io
SIRIUSEC_EXTERNAL_HOSTNAME=gus-startercluster.siriusec.io
SIRIUSEC_DYNAMO_TABLE_NAME=gus-startercluster
SIRIUSEC_DYNAMO_EVENTS_TABLE_NAME=gus-startercluster-events
SIRIUSEC_LICENSE_PATH=/home/gus/downloads/siriusec/license-gus.pem
SIRIUSEC_LOCKS_TABLE_NAME=gus-startercluster-locks
SIRIUSEC_PROXY_SERVER_LB=gus-startercluster.siriusec.io
SIRIUSEC_S3_BUCKET=gus-startercluster-s3.siriusec.io
USE_LETSENCRYPT=false
USE_ACM=true
EOF
export SIRIUSEC_TEST_FIPS_MODE=true
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
  [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

# in each test, we echo the block so that if the test fails, we can see the block being tested
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

@test "[${TEST_SUITE?}] auth_service.local_auth is false in FIPS mode" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  authentication:" -A2 | grep -q "local_auth: false"
}

@test "[${TEST_SUITE?}] auth_service.license_file is set" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  license_file: "
}

@test "[${TEST_SUITE?}] auth_service.authentication.type is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^    type:" | grep -q "oidc"
}

@test "[${TEST_SUITE?}] proxy_service.ssh_public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  ssh_public_addr:" | grep -q "${SIRIUSEC_DOMAIN_NAME?}:3023"
}

@test "[${TEST_SUITE?}] proxy_service.tunnel_public_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  tunnel_public_addr:" | grep -q "${SIRIUSEC_DOMAIN_NAME?}:3024"
}

@test "[${TEST_SUITE?}] proxy_service.listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  listen_addr: " | grep -q "0.0.0.0:3023"
}

@test "[${TEST_SUITE?}] proxy_service.tunnel_listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  tunnel_listen_addr: " | grep -q "0.0.0.0:3024"
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

@test "[${TEST_SUITE?}] node_service.listen_addr is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${NODE_BLOCK?}"
    echo "${NODE_BLOCK?}" | grep -E "^  listen_addr: " | grep -q "0.0.0.0:3022"
}
