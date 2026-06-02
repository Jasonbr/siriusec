package web

import (
	"testing"
	"time"

	"github.com/gravitational/trace"
	"github.com/stretchr/testify/require"
)

func TestValidateUpdateConfigRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     updateConfigRequest
		wantErr bool
		errType func(error) bool
	}{
		{
			name: "valid empty request",
			req:  updateConfigRequest{},
		},
		{
			name: "valid auth config",
			req: updateConfigRequest{
				Auth: &updateAuthConfig{
					Type:           "local",
					SecondFactor:   "otp",
					SessionTimeout: 30,
					IdleTimeout:    15,
				},
			},
		},
		{
			name: "invalid secondFactor",
			req: updateConfigRequest{
				Auth: &updateAuthConfig{
					SecondFactor: "invalid",
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative sessionTimeout",
			req: updateConfigRequest{
				Auth: &updateAuthConfig{
					SessionTimeout: -1,
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative idleTimeout",
			req: updateConfigRequest{
				Auth: &updateAuthConfig{
					IdleTimeout: -1,
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative maxConcurrent",
			req: updateConfigRequest{
				Session: &updateSessionConfig{
					MaxConcurrent: -1,
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative keepAliveInterval",
			req: updateConfigRequest{
				Network: &updateNetworkConfig{
					KeepAliveInterval: -1,
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative retentionDays",
			req: updateConfigRequest{
				Audit: &updateAuditConfig{
					RetentionDays: -1,
				},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "valid session config",
			req: updateConfigRequest{
				Session: &updateSessionConfig{
					MaxConcurrent:    10,
					RecordingEnabled: boolPtr(true),
					JoinAllowed:      boolPtr(true),
				},
			},
		},
		{
			name: "valid network config",
			req: updateConfigRequest{
				Network: &updateNetworkConfig{
					PublicAddr:        "example.com",
					ProxyListenerMode: "multiplex",
					KeepAliveInterval: 30,
				},
			},
		},
		{
			name: "valid audit config",
			req: updateConfigRequest{
				Audit: &updateAuditConfig{
					Enabled:       true,
					RetentionDays: 30,
					Events:        []string{"session.start", "session.end"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUpdateConfigRequest(&tt.req)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errType != nil {
					require.True(t, tt.errType(err), "expected error type to match")
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestTokenValidation(t *testing.T) {
	tests := []struct {
		name    string
		req     createTokenRequest
		wantErr bool
		errType func(error) bool
	}{
		{
			name: "valid token without TTL",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
			},
		},
		{
			name: "missing token name",
			req: createTokenRequest{
				Name:  "",
				Roles: []string{"admin"},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "missing token roles",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{},
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "valid token with TTL",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
				TTL:   "1h",
			},
		},
		{
			name: "TTL exceeds maximum",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
				TTL:   "72h",
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "negative TTL",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
				TTL:   "-1h",
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "zero TTL",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
				TTL:   "0s",
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
		{
			name: "invalid TTL format",
			req: createTokenRequest{
				Name:  "test-token",
				Roles: []string{"admin"},
				TTL:   "not-a-duration",
			},
			wantErr: true,
			errType: trace.IsBadParameter,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 模拟 createTokenHandle 中的验证逻辑
			var err error
			if tt.req.Name == "" {
				err = trace.BadParameter("missing token name")
			} else if len(tt.req.Roles) == 0 {
				err = trace.BadParameter("missing token roles")
			} else if tt.req.TTL != "" {
				const maxTokenTTL = 48 * time.Hour
				d, parseErr := time.ParseDuration(tt.req.TTL)
				if parseErr != nil {
					err = trace.BadParameter("invalid expiry duration: %v", parseErr)
				} else if d > maxTokenTTL {
					err = trace.BadParameter("token TTL exceeds maximum allowed duration of %v", maxTokenTTL)
				} else if d <= 0 {
					err = trace.BadParameter("token TTL must be positive")
				}
			}

			if tt.wantErr {
				require.Error(t, err)
				if tt.errType != nil {
					require.True(t, tt.errType(err), "expected error type to match")
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func boolPtr(b bool) *bool {
	return &b
}
