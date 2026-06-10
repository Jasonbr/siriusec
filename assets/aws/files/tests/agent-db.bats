write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=agent
EC2_REGION=us-west-2
SIRIUSEC_AGENT_DB_DESCRIPTION="Production PostgreSQL database"
SIRIUSEC_AGENT_DB_ENABLED=true
SIRIUSEC_AGENT_DB_LABELS="env: prod|another: test|third: variable-env"
SIRIUSEC_AGENT_DB_NAME=postgres-production
SIRIUSEC_AGENT_DB_REGION=us-west-2
SIRIUSEC_AGENT_DB_PROTOCOL=postgres
SIRIUSEC_AGENT_DB_URI=postgres-prod123.rds.us-west-2.amazonaws.com:5432
SIRIUSEC_JOIN_TOKEN=example-auth-token-for-tests
SIRIUSEC_PROXY_SERVER_LB=gus-tftestkube4-proxy-bc9ba568645c3d80.elb.us-east-1.amazonaws.com
EOF
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

@test "[${TEST_SUITE?}] siriusec.auth_servers is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    cat "${SIRIUSEC_CONFIG_PATH?}"
    cat "${SIRIUSEC_CONFIG_PATH?}" | grep -E "^  auth_servers:" -A1 | grep -q "${SIRIUSEC_PROXY_SERVER_LB?}"
}

@test "[${TEST_SUITE?}] siriusec.auth_token is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    cat "${SIRIUSEC_CONFIG_PATH?}"
    cat "${SIRIUSEC_CONFIG_PATH?}" | grep -E "^  auth_token:" -A1 | grep -q "${SIRIUSEC_JOIN_TOKEN?}"
}

@test "[${TEST_SUITE?}] auth_service is not enabled" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${AUTH_BLOCK?}"
    echo "${AUTH_BLOCK?}" | grep -E "^  enabled: no"
}

@test "[${TEST_SUITE?}] proxy_service is not enabled" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${PROXY_BLOCK?}"
    echo "${PROXY_BLOCK?}" | grep -E "^  enabled: no"
}

# in each test, we echo the block so that if the test fails, the block is outputted
@test "[${TEST_SUITE?}] db_service.enabled is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_BLOCK?}"
    echo "${DB_BLOCK?}" | grep -E "^  enabled: yes"
}

@test "[${TEST_SUITE?}] db_service.databases.name is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E "^  - name: ${SIRIUSEC_AGENT_DB_NAME}"
}

@test "[${TEST_SUITE?}] db_service.databases.description is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E "^    description: \"${SIRIUSEC_AGENT_DB_DESCRIPTION}\""
}

@test "[${TEST_SUITE?}] db_service.databases.protocol is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E "^    protocol: ${SIRIUSEC_AGENT_DB_PROTOCOL}"
}

@test "[${TEST_SUITE?}] db_service.databases.uri is set correctly" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E "^    uri: \"${SIRIUSEC_AGENT_DB_URI}\""
}

@test "[${TEST_SUITE?}] db_service.databases.aws.region is set correctly [specific region]" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E -A1 "^    aws:" | grep -E "^      region: ${SIRIUSEC_AGENT_DB_REGION}"
}

@test "[${TEST_SUITE?}] db_service.databases.static_labels key exists when labels are set" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -E -A1 "^    static_labels:"
}
