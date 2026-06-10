/*
Copyright 2016-2020 Siriusec

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package defaults

import (
	"io"
	"strings"
	"testing"
)

// TestMaxGeneralReadSize verifies the default read size limit is set correctly
func TestMaxGeneralReadSize(t *testing.T) {
	if MaxGeneralReadSize == 0 {
		t.Error("MaxGeneralReadSize should be set to a non-zero value")
	}

	// Verify it's 100MB (100 * 1024 * 1024 bytes)
	expected := int64(100 * 1024 * 1024)
	if MaxGeneralReadSize != expected {
		t.Errorf("MaxGeneralReadSize = %d, want %d (100MB)", MaxGeneralReadSize, expected)
	}
}

// TestBindIPDefault verifies the default bind address is localhost for security
func TestBindIPDefault(t *testing.T) {
	// Verify default BindIP is 127.0.0.1 (localhost only)
	expected := "127.0.0.1"
	if BindIP != expected {
		t.Errorf("BindIP = %q, want %q (localhost only for security)", BindIP, expected)
	}
}

// TestAnyAddressWildcard verifies the wildcard address constant
func TestAnyAddressWildcard(t *testing.T) {
	// Verify AnyAddress is 0.0.0.0 (for explicit wildcard listening)
	expected := "0.0.0.0"
	if AnyAddress != expected {
		t.Errorf("AnyAddress = %q, want %q", AnyAddress, expected)
	}
}

// TestReadAllWithLimit demonstrates LimitReader protection pattern
func TestReadAllWithLimit(t *testing.T) {
	t.Run("respects_limit", func(t *testing.T) {
		// Create data that exceeds the limit
		largeData := strings.Repeat("x", 2*1024*1024) // 2MB
		reader := strings.NewReader(largeData)

		// Wrap with LimitReader
		limitReader := io.LimitReader(reader, 1024*1024) // 1MB limit

		// Read all
		data, err := io.ReadAll(limitReader)

		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Should only read up to the limit
		if len(data) != 1024*1024 {
			t.Errorf("Read %d bytes, expected %d (limit)", len(data), 1024*1024)
		}
	})

	t.Run("reads_all_when_under_limit", func(t *testing.T) {
		// Create data under the limit
		smallData := strings.Repeat("y", 512*1024) // 512KB
		reader := strings.NewReader(smallData)

		// Wrap with LimitReader (1MB limit)
		limitReader := io.LimitReader(reader, 1024*1024)

		// Read all
		data, err := io.ReadAll(limitReader)

		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Should read all data
		if len(data) != len(smallData) {
			t.Errorf("Read %d bytes, expected %d", len(data), len(smallData))
		}
	})

	t.Run("handles_max_general_read_size", func(t *testing.T) {
		// Create data at exactly MaxGeneralReadSize
		data := strings.Repeat("z", int(MaxGeneralReadSize))
		reader := strings.NewReader(data)

		// Wrap with LimitReader using MaxGeneralReadSize
		limitReader := io.LimitReader(reader, MaxGeneralReadSize)

		// Read all
		result, err := io.ReadAll(limitReader)

		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if len(result) != int(MaxGeneralReadSize) {
			t.Errorf("Read %d bytes, expected %d (MaxGeneralReadSize)", len(result), MaxGeneralReadSize)
		}
	})
}

// TestPortDefaults verifies default port numbers
func TestPortDefaults(t *testing.T) {
	tests := []struct {
		name     string
		port     int
		expected int
	}{
		{"HTTPListenPort", HTTPListenPort, 3080},
		{"SSHServerListenPort", SSHServerListenPort, 3022},
		{"SSHProxyListenPort", SSHProxyListenPort, 3023},
		{"AuthListenPort", AuthListenPort, 3025},
		{"MySQLListenPort", MySQLListenPort, 3036},
		{"KubeListenPort", KubeListenPort, 3026},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.port != tt.expected {
				t.Errorf("%s = %d, want %d", tt.name, tt.port, tt.expected)
			}
		})
	}
}
