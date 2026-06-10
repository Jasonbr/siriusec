package utils

import (
	"os"
	"testing"
)

// TestGetEnvWithFallback tests the environment variable fallback mechanism
func TestGetEnvWithFallback(t *testing.T) {
	tests := []struct {
		name     string
		primary  string
		fallback string
		setup    func()
		expected string
		cleanup  func()
	}{
		{
			name:     "primary_exists",
			primary:  "TEST_PRIMARY",
			fallback: "TEST_FALLBACK",
			setup: func() {
				os.Setenv("TEST_PRIMARY", "primary_value")
				os.Setenv("TEST_FALLBACK", "fallback_value")
			},
			expected: "primary_value",
			cleanup: func() {
				os.Unsetenv("TEST_PRIMARY")
				os.Unsetenv("TEST_FALLBACK")
			},
		},
		{
			name:     "primary_missing_use_fallback",
			primary:  "TEST_PRIMARY",
			fallback: "TEST_FALLBACK",
			setup: func() {
				os.Setenv("TEST_FALLBACK", "fallback_value")
			},
			expected: "fallback_value",
			cleanup: func() {
				os.Unsetenv("TEST_FALLBACK")
			},
		},
		{
			name:     "both_missing",
			primary:  "TEST_PRIMARY",
			fallback: "TEST_FALLBACK",
			setup:    func() {},
			expected: "",
			cleanup:  func() {},
		},
		{
			name:     "siriusec_with_teleport_fallback",
			primary:  "SIRIUSEC_TEST_VAR",
			fallback: "TELEPORT_TEST_VAR",
			setup: func() {
				os.Setenv("TELEPORT_TEST_VAR", "teleport_value")
			},
			expected: "teleport_value",
			cleanup: func() {
				os.Unsetenv("SIRIUSEC_TEST_VAR")
				os.Unsetenv("TELEPORT_TEST_VAR")
			},
		},
		{
			name:     "siriusec_takes_precedence",
			primary:  "SIRIUSEC_TEST_VAR",
			fallback: "TELEPORT_TEST_VAR",
			setup: func() {
				os.Setenv("SIRIUSEC_TEST_VAR", "siriusec_value")
				os.Setenv("TELEPORT_TEST_VAR", "teleport_value")
			},
			expected: "siriusec_value",
			cleanup: func() {
				os.Unsetenv("SIRIUSEC_TEST_VAR")
				os.Unsetenv("TELEPORT_TEST_VAR")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			defer tt.cleanup()

			result := GetEnvWithFallback(tt.primary, tt.fallback)
			if result != tt.expected {
				t.Errorf("GetEnvWithFallback(%q, %q) = %q, want %q",
					tt.primary, tt.fallback, result, tt.expected)
			}
		})
	}
}

// TestEnsureEnvFallback tests the environment variable migration mechanism
func TestEnsureEnvFallback(t *testing.T) {
	// Save original values
	originalValues := map[string]string{
		"SIRIUSEC_CONFIG":           os.Getenv("SIRIUSEC_CONFIG"),
		"TELEPORT_CONFIG":           os.Getenv("TELEPORT_CONFIG"),
		"SIRIUSEC_CONFIG_FILE":      os.Getenv("SIRIUSEC_CONFIG_FILE"),
		"TELEPORT_CONFIG_FILE":      os.Getenv("TELEPORT_CONFIG_FILE"),
		"SIRIUSEC_TUNNEL_PUBLIC_ADDR": os.Getenv("SIRIUSEC_TUNNEL_PUBLIC_ADDR"),
		"TELEPORT_TUNNEL_PUBLIC_ADDR": os.Getenv("TELEPORT_TUNNEL_PUBLIC_ADDR"),
		"SIRIUSEC_OS_FILES":         os.Getenv("SIRIUSEC_OS_FILES"),
		"TELEPORT_OS_FILES":         os.Getenv("TELEPORT_OS_FILES"),
	}

	// Cleanup function
	defer func() {
		// Restore original values
		for key, value := range originalValues {
			if value == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, value)
			}
		}
	}()

	// Clear all test variables
	os.Unsetenv("SIRIUSEC_CONFIG")
	os.Unsetenv("TELEPORT_CONFIG")
	os.Unsetenv("SIRIUSEC_CONFIG_FILE")
	os.Unsetenv("TELEPORT_CONFIG_FILE")
	os.Unsetenv("SIRIUSEC_TUNNEL_PUBLIC_ADDR")
	os.Unsetenv("TELEPORT_TUNNEL_PUBLIC_ADDR")
	os.Unsetenv("SIRIUSEC_OS_FILES")
	os.Unsetenv("TELEPORT_OS_FILES")

	t.Run("copies_teleport_to_siriusec_when_siriusec_missing", func(t *testing.T) {
		// Setup: Set TELEPORT_ vars
		os.Setenv("TELEPORT_CONFIG", "/etc/teleport/teleport.yaml")
		os.Setenv("TELEPORT_CONFIG_FILE", "/etc/teleport/config.yaml")
		os.Setenv("TELEPORT_TUNNEL_PUBLIC_ADDR", "example.com:3024")
		os.Setenv("TELEPORT_OS_FILES", "/var/log/teleport")

		// Ensure SIRIUSEC_ vars are not set initially
		if v, ok := os.LookupEnv("SIRIUSEC_CONFIG"); ok {
			t.Fatalf("SIRIUSEC_CONFIG should not be set initially, got: %s", v)
		}

		// Call EnsureEnvFallback
		EnsureEnvFallback()

		// Verify SIRIUSEC_ vars are now set
		tests := map[string]string{
			"SIRIUSEC_CONFIG":           "/etc/teleport/teleport.yaml",
			"SIRIUSEC_CONFIG_FILE":      "/etc/teleport/config.yaml",
			"SIRIUSEC_TUNNEL_PUBLIC_ADDR": "example.com:3024",
			"SIRIUSEC_OS_FILES":         "/var/log/teleport",
		}

		for key, expected := range tests {
			if value, ok := os.LookupEnv(key); !ok {
				t.Errorf("%s should be set after EnsureEnvFallback", key)
			} else if value != expected {
				t.Errorf("%s = %q, want %q", key, value, expected)
			}
		}
	})

	t.Run("does_not_overwrite_existing_siriusec_vars", func(t *testing.T) {
		// Reset
		os.Unsetenv("SIRIUSEC_CONFIG")
		os.Unsetenv("TELEPORT_CONFIG")

		// Setup: Both SIRIUSEC_ and TELEPORT_ are set
		os.Setenv("SIRIUSEC_CONFIG", "/etc/siriusec/siriusec.yaml")
		os.Setenv("TELEPORT_CONFIG", "/etc/teleport/teleport.yaml")

		// Call EnsureEnvFallback
		EnsureEnvFallback()

		// Verify SIRIUSEC_ var is NOT overwritten
		value := os.Getenv("SIRIUSEC_CONFIG")
		if value != "/etc/siriusec/siriusec.yaml" {
			t.Errorf("SIRIUSEC_CONFIG = %q, want %q (should not be overwritten)",
				value, "/etc/siriusec/siriusec.yaml")
		}
	})

	t.Run("handles_empty_teleport_values", func(t *testing.T) {
		// Reset
		os.Unsetenv("SIRIUSEC_CONFIG")
		os.Unsetenv("TELEPORT_CONFIG")

		// Setup: TELEPORT_ is set to empty string
		os.Setenv("TELEPORT_CONFIG", "")

		// Call EnsureEnvFallback
		EnsureEnvFallback()

		// Verify SIRIUSEC_ is also empty (not set to empty string from TELEPORT_)
		if _, ok := os.LookupEnv("SIRIUSEC_CONFIG"); ok {
			t.Errorf("SIRIUSEC_CONFIG should not be set when TELEPORT_CONFIG is empty")
		}
	})
}
