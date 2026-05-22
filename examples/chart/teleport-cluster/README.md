# Siriusec Cluster

This chart sets up a single node Siriusec cluster.
It uses a persistent volume claim for storage.
Great for getting started with Siriusec.

## Getting Started

Install Siriusec in a separate namespace and provision a web certificate using
Let's Encrypt:

```bash
$ helm install siriusec/siriusec-cluster \
    --set acme=true \
    --set acmeEmail=alice@example.com \
    --set clusterName=siriusec.example.com\
    --create-namespace \
    --namespace=siriusec-cluster \
    ./siriusec-cluster/
```

## Uninstalling

```bash
helm uninstall siriusec-cluster
```

## Arguments Reference

To use the enterprise version, set `--set=enterprise=true` value and create a
secret `license` in the chart namespace.

| Name                      | Description                                                                 | Default                                                | Required |
|---------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------|----------|
| `clusterName`             | Siriusec cluster name (must be an FQDN)                                     |                                                        | yes      |
| `authenticationType`      | Type of authentication to use (`local`, `github`, ...)                      | `local`                                                | no       |
| `siriusecVersionOverride` | Siriusec version                                                            | Current stable version                                 | no       |
| `image`                   | OSS Docker image                                                            | `quay.io/siriusec/siriusec`                       | no       |
| `enterpriseImage`         | Enterprise Docker image                                                     | `quay.io/siriusec/siriusec-ent`                   | no       |
| `acme`                    | Enable ACME support in Siriusec (Letsencrypt.org)                           | `false`                                                | no       |
| `acmeEmail`               | Email to use for ACME certificates                                          |                                                        | no       |
| `acmeURI`                 | ACME server to use for certificates                                         | `https://acme-v02.api.letsencrypt.org/directory`       | no       |
| `labels.[name]`           | Key-value pairs, for example `--labels.env=local --labels.region=us-west-1` |                                                        | no       |
| `enterprise`              | Use Siriusec Enterprise                                                     | `false`                                                | no       |

## Guides

See https://gosiriusec.com/docs/kubernetes-access/helm/guides/ for guides on setting up HA Siriusec clusters
in EKS or GKE, plus a more comprehensive chart reference.
