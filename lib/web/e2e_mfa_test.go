package web

import (
	"context"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"testing"

	"github.com/siriusec/siriusec/api/constants"
	"github.com/siriusec/siriusec/api/types"

	"github.com/gravitational/roundtrip"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/require"
)

func containsAny(s string, substrs []string) bool {
	for _, substr := range substrs {
		if strings.Contains(s, substr) {
			return true
		}
	}
	return false
}

// TestE2EMFAFlow performs end-to-end MFA device management testing
func TestE2EMFAFlow(t *testing.T) {
	ctx := context.Background()
	env := newWebPack(t, 1)
	proxy := env.proxies[0]

	// Create test user with TOTP device
	const (
		loginUser = "user"
		pass      = "abc123"
		rawSecret = "def456"
	)
	otpSecret := base32.StdEncoding.EncodeToString([]byte(rawSecret))

	// Set auth preference to require OTP
	ap, err := types.NewAuthPreference(types.AuthPreferenceSpecV2{
		Type:         constants.Local,
		SecondFactor: constants.SecondFactorOTP,
	})
	require.NoError(t, err)
	err = proxy.auth.Auth().SetAuthPreference(ctx, ap)
	require.NoError(t, err)

	// Create user with initial TOTP device
	proxy.createUser(ctx, t, "testuser", loginUser, pass, otpSecret)

	// Generate valid OTP token for login
	validToken, err := totp.GenerateCode(otpSecret, proxy.clock.Now())
	require.NoError(t, err)

	// Login to get session
	clt := proxy.newClient(t)
	req := CreateSessionReq{
		User:              "testuser",
		Pass:              pass,
		SecondFactorToken: validToken,
	}

	csrfToken := "2ebcb768d0090ea4368e42880c970b61865c326172a4a2343b645cf5d7f20992"
	resp := login(t, clt, csrfToken, csrfToken, req)

	var rawSession *CreateSessionResponse
	require.NoError(t, json.Unmarshal(resp.Bytes(), &rawSession))

	session, err := rawSession.response()
	require.NoError(t, err)

	// Create authenticated client with cookies
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	clt = proxy.newClient(t, roundtrip.BearerAuth(session.Token), roundtrip.CookieJar(jar))
	jar.SetCookies(&proxy.webURL, resp.Cookies())

	// Test 1: Get MFA devices
	t.Run("GetMFADevices", func(t *testing.T) {
		resp, err := clt.Get(ctx, clt.Endpoint("webapi", "mfa", "devices"), nil)
		require.NoError(t, err)
		var devices MFADeviceListResponse
		require.NoError(t, json.Unmarshal(resp.Bytes(), &devices))
		require.Len(t, devices.Devices, 1)
		require.Equal(t, "TOTP", devices.Devices[0].Type)
		require.Equal(t, "otp", devices.Devices[0].Name)
		fmt.Printf("✅ GetMFADevices: Found %d device(s)\n", len(devices.Devices))
	})

	// Test 2: Try to add TOTP device without MFA (should fail)
	t.Run("AddTOTPRequiresMFA", func(t *testing.T) {
		_, err := clt.PostJSON(ctx, clt.Endpoint("webapi", "mfa", "totp"), AddTOTPDeviceRequest{
			Name: "second-phone",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "MFA authentication required")
		fmt.Println("✅ AddTOTPRequiresMFA: Correctly rejected without MFA")
	})

	// Test 3: Delete non-existent device (should fail)
	t.Run("DeleteNonExistent", func(t *testing.T) {
		_, err := clt.Delete(ctx, clt.Endpoint("webapi", "mfa", "devices", "non-existent"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
		fmt.Println("✅ DeleteNonExistent: Correctly returned not found")
	})

	// Test 4: Add U2F signup token (should fail without MFA)
	t.Run("AddU2FRequiresMFA", func(t *testing.T) {
		_, err := clt.PostJSON(ctx, clt.Endpoint("webapi", "u2f", "signuptokens"), AddU2FDeviceRequest{
			Name: "yubikey",
		})
		require.Error(t, err)
		require.True(t,
			containsAny(err.Error(), []string{"MFA authentication required", "unknown or missing MFAAuthenticateResponse"}),
			"Expected MFA-related error, got: %v", err)
		fmt.Println("✅ AddU2FRequiresMFA: Correctly rejected without MFA")
	})

	// Print session info for manual testing
	fmt.Println("\n📋 Session Information for Manual Testing:")
	fmt.Printf("   User: testuser\n")
	fmt.Printf("   Password: %s\n", pass)
	fmt.Printf("   OTP Secret: %s\n", otpSecret)
	fmt.Printf("   Web URL: %s\n", proxy.webURL.String())

	// Print cookies
	fmt.Println("\n🍪 Cookies:")
	cookies := jar.Cookies(&proxy.webURL)
	for _, c := range cookies {
		fmt.Printf("   %s=%s\n", c.Name, c.Value)
	}
}

// TestE2EMFAAddTOTPSuccess tests successful TOTP device registration
// for a user without existing MFA devices
func TestE2EMFAAddTOTPSuccess(t *testing.T) {
	ctx := context.Background()
	env := newWebPack(t, 1)
	proxy := env.proxies[0]

	const (
		loginUser = "user"
		pass      = "abc123"
	)

	// Set auth preference to OFF so user without MFA can login
	ap, err := types.NewAuthPreference(types.AuthPreferenceSpecV2{
		Type:         constants.Local,
		SecondFactor: constants.SecondFactorOff,
	})
	require.NoError(t, err)
	err = proxy.auth.Auth().SetAuthPreference(ctx, ap)
	require.NoError(t, err)

	// Create user WITHOUT MFA device
	proxy.createUser(ctx, t, "newuser", loginUser, pass, "")

	// Login without OTP
	clt := proxy.newClient(t)
	req := CreateSessionReq{
		User: "newuser",
		Pass: pass,
	}

	csrfToken := "2ebcb768d0090ea4368e42880c970b61865c326172a4a2343b645cf5d7f20992"
	resp := login(t, clt, csrfToken, csrfToken, req)

	var rawSession *CreateSessionResponse
	require.NoError(t, json.Unmarshal(resp.Bytes(), &rawSession))

	session, err := rawSession.response()
	require.NoError(t, err)

	// Create authenticated client with cookies
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	clt = proxy.newClient(t, roundtrip.BearerAuth(session.Token), roundtrip.CookieJar(jar))
	jar.SetCookies(&proxy.webURL, resp.Cookies())

	// Step 1: Initiate TOTP device registration
	fmt.Println("\n🔐 Testing TOTP Device Registration Success Path:")

	var totpSecret string
	t.Run("InitiateTOTPRegistration", func(t *testing.T) {
		resp, err := clt.PostJSON(ctx, clt.Endpoint("webapi", "mfa", "totp"), AddTOTPDeviceRequest{
			Name: "my-phone",
		})
		require.NoError(t, err)

		var result AddTOTPDeviceResponse
		require.NoError(t, json.Unmarshal(resp.Bytes(), &result))

		require.NotEmpty(t, result.Secret, "Secret should not be empty")
		require.NotEmpty(t, result.QRCode, "QRCode should not be empty")

		totpSecret = result.Secret
		fmt.Printf("✅ InitiateTOTPRegistration: Got secret and QR code\n")
		fmt.Printf("   Secret: %s...\n", totpSecret[:10])
	})

	// Step 2: Verify TOTP device with generated code
	t.Run("VerifyTOTPDevice", func(t *testing.T) {
		require.NotEmpty(t, totpSecret, "TOTP secret must be set from previous test")

		// Generate valid TOTP code
		code, err := totp.GenerateCode(totpSecret, proxy.clock.Now())
		require.NoError(t, err)

		_, err = clt.PostJSON(ctx, clt.Endpoint("webapi", "mfa", "totp", "verify"), VerifyTOTPRequest{
			Token: totpSecret,
			Code:  code,
		})
		require.NoError(t, err)
		fmt.Printf("✅ VerifyTOTPDevice: Device registered successfully\n")
	})

	// Step 3: Verify device appears in list
	t.Run("VerifyDeviceInList", func(t *testing.T) {
		resp, err := clt.Get(ctx, clt.Endpoint("webapi", "mfa", "devices"), nil)
		require.NoError(t, err)

		var devices MFADeviceListResponse
		require.NoError(t, json.Unmarshal(resp.Bytes(), &devices))
		require.Len(t, devices.Devices, 1, "Should have exactly 1 device")
		require.Equal(t, "TOTP", devices.Devices[0].Type)
		require.Equal(t, "my-phone", devices.Devices[0].Name)
		fmt.Printf("✅ VerifyDeviceInList: Found %d device(s), name=%s\n",
			len(devices.Devices), devices.Devices[0].Name)
	})
}

// TestE2EMFADeleteDeviceSuccess tests successful MFA device deletion
// for a user with exactly 1 MFA device (no additional MFA required)
func TestE2EMFADeleteDeviceSuccess(t *testing.T) {
	ctx := context.Background()
	env := newWebPack(t, 1)
	proxy := env.proxies[0]

	const (
		loginUser = "user"
		pass      = "abc123"
		rawSecret = "def456"
	)
	otpSecret := base32.StdEncoding.EncodeToString([]byte(rawSecret))

	// Set auth preference to off so deleting the last device is allowed
	ap, err := types.NewAuthPreference(types.AuthPreferenceSpecV2{
		Type:         constants.Local,
		SecondFactor: constants.SecondFactorOff,
	})
	require.NoError(t, err)
	err = proxy.auth.Auth().SetAuthPreference(ctx, ap)
	require.NoError(t, err)

	// Create user with exactly 1 TOTP device
	proxy.createUser(ctx, t, "deleteuser", loginUser, pass, otpSecret)

	// Generate valid OTP token for login
	validToken, err := totp.GenerateCode(otpSecret, proxy.clock.Now())
	require.NoError(t, err)

	// Login to get session
	clt := proxy.newClient(t)
	req := CreateSessionReq{
		User:              "deleteuser",
		Pass:              pass,
		SecondFactorToken: validToken,
	}

	csrfToken := "2ebcb768d0090ea4368e42880c970b61865c326172a4a2343b645cf5d7f20992"
	resp := login(t, clt, csrfToken, csrfToken, req)

	var rawSession *CreateSessionResponse
	require.NoError(t, json.Unmarshal(resp.Bytes(), &rawSession))

	session, err := rawSession.response()
	require.NoError(t, err)

	// Create authenticated client with cookies
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	clt = proxy.newClient(t, roundtrip.BearerAuth(session.Token), roundtrip.CookieJar(jar))
	jar.SetCookies(&proxy.webURL, resp.Cookies())

	fmt.Println("\n🗑️  Testing MFA Device Deletion Success Path:")

	// Step 1: Get device ID
	var deviceID string
	t.Run("GetDeviceForDeletion", func(t *testing.T) {
		resp, err := clt.Get(ctx, clt.Endpoint("webapi", "mfa", "devices"), nil)
		require.NoError(t, err)

		var devices MFADeviceListResponse
		require.NoError(t, json.Unmarshal(resp.Bytes(), &devices))
		require.Len(t, devices.Devices, 1, "Should have exactly 1 device")
		require.NotEmpty(t, devices.Devices[0].ID, "Device ID should not be empty")

		deviceID = devices.Devices[0].ID
		fmt.Printf("✅ GetDeviceForDeletion: Found device ID=%s, name=%s\n",
			deviceID, devices.Devices[0].Name)
	})

	// Step 2: Delete the device (requires TOTP MFA since user has a TOTP device)
	t.Run("DeleteDevice", func(t *testing.T) {
		require.NotEmpty(t, deviceID, "Device ID must be set from previous test")

		validToken, err := totp.GenerateCode(otpSecret, proxy.clock.Now())
		require.NoError(t, err)

		_, err = clt.DeleteWithParams(ctx, clt.Endpoint("webapi", "mfa", "devices", deviceID), url.Values{
			"totpCode": []string{validToken},
		})
		require.NoError(t, err)
		fmt.Printf("✅ DeleteDevice: Successfully deleted device %s\n", deviceID)
	})

	// Step 3: Verify device is gone
	t.Run("VerifyDeviceDeleted", func(t *testing.T) {
		resp, err := clt.Get(ctx, clt.Endpoint("webapi", "mfa", "devices"), nil)
		require.NoError(t, err)

		var devices MFADeviceListResponse
		require.NoError(t, json.Unmarshal(resp.Bytes(), &devices))
		require.Len(t, devices.Devices, 0, "Should have 0 devices after deletion")
		fmt.Printf("✅ VerifyDeviceDeleted: Device list is empty\n")
	})
}
