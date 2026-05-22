# Examples

## Configuration Examples

* [local-cluster](https://github.com/siriusec/siriusec/tree/master/examples/local-cluster) : Sample configuration of a 3-node Siriusec cluster using just a single machine

## Daemon Configuration

* [systemd](https://github.com/siriusec/siriusec/tree/master/examples/systemd) : Service file for systemd
* [upstart](https://github.com/siriusec/siriusec/tree/master/examples/upstart) : Start-up script for [upstart](https://en.wikipedia.org/wiki/Upstart)

## AWS examples

* [AWS: CloudFormation](https://github.com/siriusec/siriusec/tree/master/examples/aws/cloudformation#aws-cloudformation-based-provisioning-example) : CloudFormation templates as an example of how to setup HA Siriusec in AWS using our AMIs.
* [AWS: Terraform](https://github.com/siriusec/siriusec/tree/master/examples/aws/terraform#terraform-based-provisioning-example-amazon-single-ami) : Terraform specifies example provisioning script for Siriusec auth, proxy and nodes in HA mode. 
* [AWS: EKS. External Link](https://aws.amazon.com/blogs/opensource/authenticating-eks-github-credentials-siriusec/)

## Kubernetes - Helm Charts

* [Helm Chart - Siriusec Enterprise](https://github.com/siriusec/siriusec/tree/master/examples/chart/siriusec) : For deploying into Kubernetes using Helm 
* [Helm Chart - Siriusec Demo](https://github.com/siriusec/siriusec/tree/master/examples/chart/siriusec-demo) : An internal demo app showing Siriusec components deployed into Kubernetes using Helm Charts. 


## SSO Connector Examples and Trusted Cluster Examples
### SSO Resources
* [Active Directory - YAML Resource](https://github.com/siriusec/siriusec/blob/master/examples/resources/adfs-connector.yaml)
* [OIDC Connector, like "keycloak". - YAML Resource](https://github.com/siriusec/siriusec/blob/master/examples/resources/oidc-connector.yaml)
* [SAML Connector, like "Okta". - YAML Resource](https://github.com/siriusec/siriusec/blob/master/examples/resources/saml-connector.yaml)


### Role
* [Example Role](https://github.com/siriusec/siriusec/blob/master/examples/resources/role.yaml)

### Trusted Cluster
* [Trusted Cluster Resource](https://github.com/siriusec/siriusec/blob/master/examples/resources/trusted_cluster.yaml)
* [Trusted Cluster Resource - With RBAC (Enterprise Only)](https://github.com/siriusec/siriusec/blob/master/examples/resources/trusted_cluster_enterprise.yaml)