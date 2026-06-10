#!/bin/bash
cat >/etc/siriusec.d/conf <<EOF
SIRIUSEC_ROLE=proxy
EC2_REGION=${region}
SIRIUSEC_AUTH_SERVER_LB=${auth_server_addr}
SIRIUSEC_CLUSTER_NAME=${cluster_name}
SIRIUSEC_DOMAIN_NAME=${domain_name}
SIRIUSEC_INFLUXDB_ADDRESS=${influxdb_addr}
SIRIUSEC_PROXY_SERVER_LB=${proxy_server_lb_addr}
SIRIUSEC_PROXY_SERVER_NLB_ALIAS=${proxy_server_nlb_alias}
SIRIUSEC_S3_BUCKET=${s3_bucket}
USE_ACM=${use_acm}
EOF