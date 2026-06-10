package utils

import (
	"bufio"
	"os"
	"strings"

	siriusec "github.com/siriusec/siriusec"

	log "github.com/sirupsen/logrus"
)

// ReadEnvironmentFile will read environment variables from a passed in location.
// Lines that start with "#" or empty lines are ignored. Assignments are in the
// form name=value and no variable expansion occurs.
func ReadEnvironmentFile(filename string) ([]string, error) {
	// open the users environment file. if we don't find a file, move on as
	// having this file for the user is optional.
	file, err := os.Open(filename)
	if err != nil {
		log.Warnf("Unable to open environment file %v: %v, skipping", filename, err)
		return []string{}, nil
	}
	defer file.Close()

	var lineno int
	var envs []string

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// follow the lead of OpenSSH and don't allow more than 1,000 environment variables
		// https://github.com/openssh/openssh-portable/blob/master/session.c#L873-L874
		lineno = lineno + 1
		if lineno > siriusec.MaxEnvironmentFileLines {
			log.Warnf("Too many lines in environment file %v, returning first %v lines", filename, siriusec.MaxEnvironmentFileLines)
			return envs, nil
		}

		// empty lines or lines that start with # are ignored
		if line == "" || line[0] == '#' {
			continue
		}

		// split on first =, if not found, log it and continue
		idx := strings.Index(line, "=")
		if idx == -1 {
			log.Debugf("Bad line %v while reading %v: no = separator found", lineno, filename)
			continue
		}

		// split key and value and make sure that key has a name
		key := line[:idx]
		value := line[idx+1:]
		if strings.TrimSpace(key) == "" {
			log.Debugf("Bad line %v while reading %v: key without name", lineno, filename)
			continue
		}

		envs = append(envs, key+"="+value)
	}

	err = scanner.Err()
	if err != nil {
		log.Warnf("Unable to read environment file %v: %v, skipping", filename, err)
		return []string{}, nil
	}

	return envs, nil
}

// GetEnvWithFallback looks up an environment variable with a primary key,
// falling back to a secondary key if the primary is not set. This enables
// backward-compatible environment variable renaming (e.g., SIRIUSEC_* with
// TELEPORT_* fallback).
func GetEnvWithFallback(primary, fallback string) string {
	if v := os.Getenv(primary); v != "" {
		return v
	}
	return os.Getenv(fallback)
}

// EnsureEnvFallback copies TELEPORT_* environment variables to their SIRIUSEC_*
// equivalents when the SIRIUSEC_* variable is not set. This provides backward
// compatibility for existing deployments using TELEPORT_* env vars, particularly
// for CLI frameworks like kingpin that only support a single env var per flag.
func EnsureEnvFallback() {
	fallbacks := []struct{ siriusec, teleport string }{
		{"SIRIUSEC_CONFIG", "TELEPORT_CONFIG"},
		{"SIRIUSEC_CONFIG_FILE", "TELEPORT_CONFIG_FILE"},
		{"SIRIUSEC_TUNNEL_PUBLIC_ADDR", "TELEPORT_TUNNEL_PUBLIC_ADDR"},
		{"SIRIUSEC_OS_FILES", "TELEPORT_OS_FILES"},
	}
	for _, fb := range fallbacks {
		if os.Getenv(fb.siriusec) == "" && os.Getenv(fb.teleport) != "" {
			os.Setenv(fb.siriusec, os.Getenv(fb.teleport))
		}
	}
}
