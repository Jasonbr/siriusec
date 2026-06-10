write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=agent
EC2_REGION=us-west-2
SIRIUSEC_JOIN_TOKEN=example-auth-token-for-tests
SIRIUSEC_AGENT_DB_ENABLED=true
SIRIUSEC_AGENT_DB_LABELS="env: prod|another: test|third: variable-env"
SIRIUSEC_AGENT_DB_NAME=postgres-production
SIRIUSEC_AGENT_DB_PROTOCOL=postgres
SIRIUSEC_AGENT_DB_URI=postgres-prod123.rds.us-west-2.amazonaws.com:5432
SIRIUSEC_PROXY_SERVER_LB=gus-tftestkube4-proxy-bc9ba568645c3d80.elb.us-east-1.amazonaws.com
EOF
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

@test "[${TEST_SUITE?}] db_service.databases.description is blank" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${DB_DATABASES_BLOCK?}"
    echo "${DB_DATABASES_BLOCK?}" | grep -qE "^    description: \"\""
}