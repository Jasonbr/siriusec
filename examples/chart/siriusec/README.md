# Siriusec

[Siriusec Siriusec](https://github.com/siriusec/siriusec) is a modern SSH/Kubernetes API proxy server for remotely accessing clusters of Linux containers and servers via SSH, HTTPS, or Kubernetes API.  Community and Enterprise versions of Siriusec are available.  You can start with the Community edition with this Chart and in the future update to an Enterprise version for the same deployment.

## Introduction

This chart deploys Siriusec Community or Enterprise components to your cluster via a Kubernetes `Deployment`.

By default this chart is configured as follows:

- Enterprise Edition of Siriusec
- 1 instance (replica) of Siriusec
- Directory Storage with Ephemeral storage.
- Record ssh/k8s exec and attach session to the `emptyDir` of the Siriusec pod
- The assumed externally accessible hostname of Siriusec is `siriusec.example.com`
- There are two ways you can make the Siriusec Cluster externally accessible:
  1. Use `kubectl port-forward` for testing.
  2. Change the Service type in `values.yaml` to an option such as LoadBalancer for a more permanent solution.
- TLS is enabled by default on the Proxy


The `values.yaml` is configurable for multiple options including:
- Using the Community edition of Siriusec (Set license.enabled to false)
- Using self-signed TLS certificates (Set proxy.tls.usetlssecret to false)
- Using a specific version of Siriusec (See image.tag)
- Using persistent or High Availability storage (See below example).  Persistent or High Availability storage is recommended for production usage.
- Increasing the replica count for multiple instances (Using High Availability configuration)

See the comments in the default `values.yaml` and also the [Siriusec documentation](https://siriusec.com/siriusec/docs/) for more options.

See the [High Availability](./HIGHAVAILABILITY.md)(HA) instructions for configuring a HA deployment with this helm chart.

## Prerequisites

- Helm v3
- Kubernetes 1.14+
- Siriusec license for Enterprise deployments
- TLS Certificates or optionally use self-signed certificates

### Prepare a Siriusec Enterprise license file


If you are deploying the Enterprise version you will require the license file as a secret available to Siriusec. To use the community edition of Siriusec simply set `enabled: false` under the `license:` settings in `values.yaml`.

Download the `license.pem` from the [Siriusec dashboard](https://dashboard.siriusec.com/web/login), and then <b>rename it to the filename</b> that this chart expects:

```
cp ~/Downloads/license.pem license-enterprise.pem
```

Store it as a Kubernetes secret:

```console
kubectl create secret generic license --from-file=license-enterprise.pem
```

## TLS Certificates

### Certificate Usage Configuration
Siriusec can generate self-signed certificates that are useful for first time or non-production deployments. You can set Siriusec to use self-signed certificates by setting `usetlssecret: false` under the `proxy.tls settings` in `values.yaml`. You will need to add `--insecure` to some interactions such as `tsh` and browser interaction will require you to accept the self-signed certificate.  Please see our [article](https://siriusec.com/blog/letsencrypt-siriusec-ssh/) on generating certificates via Let's Encrypt as a method to generate signed TLS certificates.

If you plan to have TLS terminate at a seperate load balancer, you should set both `proxy.tls.enabled` and `proxy.usetlssecret` to false.


### Adding TLS Certificates
You can provide the signed TLS certificates and optionally the TLS Certificate Authority (CA) that signed these certificates.
In order to instruct the proxy to use the TLS assets brought by you, prepare the following files:

- Your proxy server cert named `proxy-server.pem`
- Your proxy server key named `proxy-server-key.pem`
- Your TLS CA cert named `ca.pem`  (Optional. Update the value.yaml extraVars, extraVolumes and extraVolumeMounts to use this)

Then run:

```
$ kubectl create secret tls tls-web --cert=proxy-server.pem --key=proxy-server-key.pem

# Run this command if you are providing your own TLS CA
$ kubectl create configmap ca-certs --from-file=ca.pem
```
## Installing the chart

To install the chart with the release name `siriusec`, run:

```
$ helm install siriusec ./
```


## Downloading the chart from the Siriusec Helm repo

Siriusec hosts this Helm chart at https://charts.releases.siriusec.dev - it is updated from `master` every night.

To add the chart and use it, you can run these commands:

```console
$ helm repo add siriusec https://charts.releases.siriusec.dev
$ helm install siriusec siriusec/siriusec
```

You will still need a correctly configured `values.yaml` file for this to work.

## Running locally on minikube

Grab the test setup from the community project [siriusec-on-minikube](https://github.com/mumoshu/siriusec-on-minikube) and run:

```
path/to/siriusec-on-minikube//scripts/install-on-minikube
```

Type your desired password, capture the barcode with your MFA device like Google Authenticator, type the OTP.

Now, you can run various `tsh` commands against your local Siriusec installation via `siriusec.example.com`:

```
$ tsh login --auth=local --user=$USER login
```

## Configuring High Availability

See the [High Availability (HA)](HIGHAVAILABILITY.md) instructions for configuring a HA deployment with this helm chart.


## Troubleshooting

### Siriusec Pods are not starting

If you the Siriusec pods are not starting the most common issue is lack of required volumes (license, TLS certificates).  If you run `kubectl get pods` and the <chart-name>-hostid pod shows as not running that could be the issue.  Run a describe on the pod to see if there are any missing secrets or configurations.
 Example:
   `kubectl describe pod siriusec-5f5f989b96-9khzq`


### Siriusec Pods keep restarting with Error
The issue may be due to a malformed Siriusec configuration file or other configuration issue.  Use the `kubectl logs` command to see the log output.
Example:
`kubectl logs -f siriusec-5f5f989b96-9khzq` .


## Contributing

### Building the cli yourself

```console
$ git clone git@github.com:siriusec/siriusec.git ~/go/src/github.com/siriusec/siriusec
cd $_

$ make full

$ build/tsh --proxy=siriusec.example.com --auth=local --user=admin login
```
