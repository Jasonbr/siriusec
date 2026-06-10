#!/bin/bash
cat >/etc/siriusec.d/conf <<EOF
SIRIUSEC_ROLE=auth,node,proxy
EC2_REGION=${region}
SIRIUSEC_AUTH_SERVER_LB=localhost
SIRIUSEC_CLUSTER_NAME=${cluster_name}
SIRIUSEC_DOMAIN_ADMIN_EMAIL=${email}
SIRIUSEC_DOMAIN_NAME=${domain_name}
SIRIUSEC_EXTERNAL_HOSTNAME=${domain_name}
SIRIUSEC_DYNAMO_TABLE_NAME=${dynamo_table_name}
SIRIUSEC_DYNAMO_EVENTS_TABLE_NAME=${dynamo_events_table_name}
SIRIUSEC_LICENSE_PATH=${license_path}
SIRIUSEC_LOCKS_TABLE_NAME=${locks_table_name}
SIRIUSEC_PROXY_SERVER_LB=${domain_name}
SIRIUSEC_S3_BUCKET=${s3_bucket}
USE_LETSENCRYPT=${use_letsencrypt}
USE_ACM=${use_acm}
EOF