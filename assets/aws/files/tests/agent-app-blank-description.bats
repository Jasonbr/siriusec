write_confd_file() {
    cat << EOF > ${SIRIUSEC_CONFD_DIR?}/conf
SIRIUSEC_ROLE=agent
EC2_REGION=us-west-2
SIRIUSEC_AGENT_APP_ENABLED=true
SIRIUSEC_AGENT_APP_LABELS="env: prod|app: grafana"
SIRIUSEC_AGENT_APP_NAME=grafana-prod
SIRIUSEC_AGENT_APP_URI=grafana001.mycluster.hosting:3000
SIRIUSEC_JOIN_TOKEN=example-auth-token-for-tests
SIRIUSEC_PROXY_SERVER_LB=gus-tftestkube4-proxy-bc9ba568645c3d80.elb.us-east-1.amazonaws.com
EOF
}

load fixtures/common

@test "[${TEST_SUITE?}] config file was generated without error" {
    [ ${GENERATE_EXIT_CODE?} -eq 0 ]
}

@test "[${TEST_SUITE?}] app_service.apps.description is blank" {
    load ${SIRIUSEC_CONFD_DIR?}/conf
    echo "${APP_APPS_BLOCK?}"
    echo "${APP_APPS_BLOCK?}" | grep -qE "^    description: \"\""
}