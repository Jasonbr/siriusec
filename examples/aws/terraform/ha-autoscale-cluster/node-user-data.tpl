#!/bin/bash
cat >/etc/siriusec.d/conf <<EOF
SIRIUSEC_ROLE=node
EC2_REGION=${region}
SIRIUSEC_AUTH_SERVER_LB=${auth_server_addr}
SIRIUSEC_CLUSTER_NAME=${cluster_name}
SIRIUSEC_INFLUXDB_ADDRESS=${influxdb_addr}
USE_ACM=${use_acm}
EOF