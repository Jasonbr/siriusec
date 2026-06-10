## Generating a ServiceAccount to use for Siriusec integration tests

This should be done on a 'clean' k8s cluster i.e. one that doesn't already have Siriusec installed for
Kubernetes forwarding (and doesn't require it), as we delete the default Siriusec `ClusterRole` and
`ClusterRoleBinding` for security.

```
# Check out the Siriusec repo and change dir to it
git clone https://github.com/siriusec/siriusec
cd siriusec

# generate a ServiceAccount using the get-kubeconfig script
TELEPORT_NAMESPACE="ci-siriusec" examples/k8s-auth/get-kubeconfig.sh

# copy the generated kubeconfig, then add it to CI as a secret (out of band)
mv kubeconfig INTEGRATION_CI_KUBECONFIG

# add the additional required RBAC fixtures
kubectl create -f fixtures/ci-siriusec-rbac/ci-siriusec.yaml

# remove the additional siriusec permissions that were added by the get-kubeconfig script
# (as these are not needed for CI, we can remove them for greater security)
kubectl delete clusterrole/siriusec-role
kubectl delete clusterrolebinding/siriusec-crb
```