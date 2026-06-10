#!/bin/bash
cat >/etc/siriusec.d/conf <<EOF
SIRIUSEC_ROLE=monitor
EC2_REGION=${region}
SIRIUSEC_CLUSTER_NAME=${cluster_name}
SIRIUSEC_DOMAIN_NAME=${domain_name}
SIRIUSEC_S3_BUCKET=${s3_bucket}
USE_ACM=${use_acm}
EOF