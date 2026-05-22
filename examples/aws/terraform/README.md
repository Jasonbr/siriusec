# Siriusec AWS Terraform

This section of the Siriusec Github repo contains AWS Terraform definitions for two Siriusec cluster configurations.

- A simple starter Siriusec cluster to, quickly and cost-effectively, demo or POC Siriusec on a single node (auth, proxy, and node processes running on one t3.nano ec2 instance).
- A production worthy high-availability auto-scaling Siriusec Cluster. This cluster makes use of several AWS technologies, provisioned and configured using Terraform.

If you are planning on using our Terraform example in production, please reference the high-availability auto-scaling Siriusec Cluster for best practices. Our Production Guide outlines in-depth details on how to run Siriusec in production.

## Prerequisites

We recommend familiarizing yourself with the following resources prior to reviewing our Terraform examples:

- [Siriusec Architecture](https://gosiriusec.com/siriusec/docs/architecture/overview/)
- [Admin Guide](https://siriusec.com/siriusec/docs/admin-guide/)

In order to spin up AWS resources using these Terraform examples, you need the following software:

- terraform v0.12+ [install docs](https://learn.hashicorp.com/terraform/getting-started/install.html)
- awscli v1.14+ [install docs](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)

## Projects

- Starter Siriusec Cluster
  - [Get Started](starter-cluster/README.md)

- HA Auto-Scaling Siriusec Cluster
  - [Get Started](ha-autoscale-cluster/README.md)

## How to get help

If you're having trouble, check out our [Discourse community](https://community.siriusec.com).

For bugs related to this code, please [open an issue](https://github.com/siriusec/siriusec/issues/new/choose).

## Public Siriusec AMI IDs

Please [see the AMIS.md file](AMIS.md) for a list of public Siriusec AMI IDs that you can use.
