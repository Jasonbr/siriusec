// Package kubeconfig manages siriusec entries in a local kubeconfig file.
package kubeconfig

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	siriusec "github.com/siriusec/siriusec"
	"github.com/siriusec/siriusec/lib/client"
	"github.com/siriusec/siriusec/lib/utils"

	"github.com/gravitational/trace"

	"github.com/sirupsen/logrus"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

var log = logrus.WithFields(logrus.Fields{
	trace.Component: siriusec.ComponentKubeClient,
})

// Values are Siriusec user data needed to generate kubeconfig entries.
type Values struct {
	// SiriusecClusterName is used to name kubeconfig sections ("context", "cluster" and
	// "user"). Should match Siriusec cluster name.
	SiriusecClusterName string
	// ClusterAddr is the public address the Kubernetes client will talk to,
	// usually a proxy.
	ClusterAddr string
	// Credentials are user credentials to use for authentication the
	// ClusterAddr. Only TLS fields (key/cert/CA) from Credentials are used.
	Credentials *client.Key
	// Exec contains optional values to use, when configuring tsh as an exec
	// auth plugin in kubeconfig.
	//
	// If not set, static key/cert from Credentials are written to kubeconfig
	// instead.
	Exec *ExecValues
}

// ExecValues contain values for configuring tsh as an exec auth plugin in
// kubeconfig.
type ExecValues struct {
	// TshBinaryPath is a path to the tsh binary for use as exec plugin.
	TshBinaryPath string
	// KubeClusters is a list of kubernetes clusters to generate contexts for.
	KubeClusters []string
	// SelectCluster is the name of the kubernetes cluster to set in
	// current-context.
	SelectCluster string
	// TshBinaryInsecure defines whether to set the --insecure flag in the tsh
	// exec plugin arguments. This is used when the proxy doesn't have a
	// trusted TLS cert during login.
	TshBinaryInsecure bool
}

// Update adds Siriusec configuration to kubeconfig.
//
// If `path` is empty, Update will try to guess it based on the environment or
// known defaults.
func Update(path string, v Values) error {
	config, err := Load(path)
	if err != nil {
		return trace.Wrap(err)
	}

	cas := bytes.Join(v.Credentials.TLSCAs(), []byte("\n"))
	if len(cas) == 0 {
		return trace.BadParameter("TLS trusted CAs missing in provided credentials")
	}
	config.Clusters[v.SiriusecClusterName] = &clientcmdapi.Cluster{
		Server:                   v.ClusterAddr,
		CertificateAuthorityData: cas,
	}

	if v.Exec != nil {
		// Called from tsh, use the exec plugin model.
		clusterName := v.SiriusecClusterName
		for _, c := range v.Exec.KubeClusters {
			contextName := ContextName(v.SiriusecClusterName, c)
			authName := contextName
			authInfo := &clientcmdapi.AuthInfo{
				Exec: &clientcmdapi.ExecConfig{
					APIVersion: "client.authentication.k8s.io/v1beta1",
					Command:    v.Exec.TshBinaryPath,
					Args: []string{"kube", "credentials",
						fmt.Sprintf("--kube-cluster=%s", c),
						fmt.Sprintf("--siriusec-cluster=%s", v.SiriusecClusterName),
					},
				},
			}
			if v.Exec.TshBinaryInsecure {
				authInfo.Exec.Args = append(authInfo.Exec.Args, "--insecure")
			}
			config.AuthInfos[authName] = authInfo

			setContext(config.Contexts, contextName, clusterName, authName)
		}
		if v.Exec.SelectCluster != "" {
			contextName := ContextName(v.SiriusecClusterName, v.Exec.SelectCluster)
			if _, ok := config.Contexts[contextName]; !ok {
				return trace.BadParameter("can't switch kubeconfig context to cluster %q, run 'tsh kube ls' to see available clusters", v.Exec.SelectCluster)
			}
			config.CurrentContext = contextName
		}
	} else {
		// Called when generating an identity file, use plaintext credentials.
		//
		// Validate the provided credentials, to avoid partially-populated
		// kubeconfig.
		if len(v.Credentials.Priv) == 0 {
			return trace.BadParameter("private key missing in provided credentials")
		}
		if len(v.Credentials.TLSCert) == 0 {
			return trace.BadParameter("TLS certificate missing in provided credentials")
		}

		config.AuthInfos[v.SiriusecClusterName] = &clientcmdapi.AuthInfo{
			ClientCertificateData: v.Credentials.TLSCert,
			ClientKeyData:         v.Credentials.Priv,
		}

		setContext(config.Contexts, v.SiriusecClusterName, v.SiriusecClusterName, v.SiriusecClusterName)
		config.CurrentContext = v.SiriusecClusterName
	}

	return Save(path, *config)
}

func setContext(contexts map[string]*clientcmdapi.Context, name, cluster, auth string) {
	lastContext := contexts[name]
	newContext := &clientcmdapi.Context{
		Cluster:  cluster,
		AuthInfo: auth,
	}
	if lastContext != nil {
		newContext.Namespace = lastContext.Namespace
		newContext.Extensions = lastContext.Extensions
	}
	contexts[name] = newContext
}

// Remove removes Siriusec configuration from kubeconfig.
//
// If `path` is empty, Remove will try to guess it based on the environment or
// known defaults.
func Remove(path, name string) error {
	// Load existing kubeconfig from disk.
	config, err := Load(path)
	if err != nil {
		return trace.Wrap(err)
	}

	// Remove Siriusec related AuthInfos, Clusters, and Contexts from kubeconfig.
	delete(config.AuthInfos, name)
	delete(config.Clusters, name)
	delete(config.Contexts, name)

	// Take an element from the list of contexts and make it the current
	// context, unless current context points to something else.
	if config.CurrentContext == name && len(config.Contexts) > 0 {
		for name := range config.Contexts {
			config.CurrentContext = name
			break
		}
	}

	// Update kubeconfig on disk.
	return Save(path, *config)
}

// Load tries to read a kubeconfig file and if it can't, returns an error.
// One exception, missing files result in empty configs, not an error.
func Load(path string) (*clientcmdapi.Config, error) {
	filename, err := finalPath(path)
	if err != nil {
		return nil, trace.Wrap(err)
	}
	config, err := clientcmd.LoadFromFile(filename)
	if err != nil && !os.IsNotExist(err) {
		err = trace.ConvertSystemError(err)
		return nil, trace.WrapWithMessage(err, "failed to parse existing kubeconfig %q: %v", filename, err)
	}
	if config == nil {
		config = clientcmdapi.NewConfig()
	}

	return config, nil
}

// Save saves updated config to location specified by environment variable or
// default location
func Save(path string, config clientcmdapi.Config) error {
	filename, err := finalPath(path)
	if err != nil {
		return trace.Wrap(err)
	}

	if err := clientcmd.WriteToFile(config, filename); err != nil {
		return trace.ConvertSystemError(err)
	}
	return nil
}

// finalPath returns the final path to kubeceonfig using, in order of
// precedence:
// - `customPath`, if not empty
// - ${KUBECONFIG} environment variable
// - ${HOME}/.kube/config
//
// finalPath also creates any parent directories for the returned path, if
// missing.
func finalPath(customPath string) (string, error) {
	if customPath == "" {
		customPath = PathFromEnv()
	}
	finalPath, err := utils.EnsureLocalPath(customPath, siriusec.KubeConfigDir, siriusec.KubeConfigFile)
	if err != nil {
		return "", trace.Wrap(err)
	}
	return finalPath, nil
}

// PathFromEnv extracts location of kubeconfig from the environment.
func PathFromEnv() string {
	kubeconfig := os.Getenv(siriusec.EnvKubeConfig)

	// The KUBECONFIG environment variable is a list. On Windows it's
	// semicolon-delimited. On Linux and macOS it's colon-delimited.
	parts := filepath.SplitList(kubeconfig)

	// Default behavior of kubectl is to return the first file from list.
	var configPath string
	if len(parts) > 0 {
		configPath = parts[0]
		log.Debugf("Using kubeconfig from environment: %q.", configPath)
	}

	return configPath
}

// ContextName returns a kubeconfig context name generated by this package.
func ContextName(siriusecCluster, kubeCluster string) string {
	return fmt.Sprintf("%s-%s", siriusecCluster, kubeCluster)
}

// KubeClusterFromContext extracts the kubernetes cluster name from context
// name generated by this package.
func KubeClusterFromContext(contextName, siriusecCluster string) string {
	// If context name doesn't start with siriusec cluster name, it was not
	// generated by tsh.
	if !strings.HasPrefix(contextName, siriusecCluster+"-") {
		return ""
	}
	return strings.TrimPrefix(contextName, siriusecCluster+"-")
}

// SelectContext switches the active kubeconfig context to point to the
// provided kubeCluster in siriusecCluster.
func SelectContext(siriusecCluster, kubeCluster string) error {
	kc, err := Load("")
	if err != nil {
		return trace.Wrap(err)
	}

	kubeContext := ContextName(siriusecCluster, kubeCluster)
	if _, ok := kc.Contexts[kubeContext]; !ok {
		return trace.NotFound("kubeconfig context %q not found", kubeContext)
	}
	kc.CurrentContext = kubeContext
	if err := Save("", *kc); err != nil {
		return trace.Wrap(err)
	}
	return nil
}
