// mfa_handlers.go - MFA device management REST API handlers
//
// This file implements the REST API for MFA device management:
// - GET /webapi/mfa/devices - list MFA devices
// - POST /webapi/mfa/totp - initiate TOTP device registration
// - POST /webapi/mfa/totp/verify - complete TOTP device registration
// - POST /webapi/u2f/signuptokens - initiate U2F device registration
// - POST /webapi/mfa/u2f - complete U2F device registration
// - DELETE /webapi/mfa/devices/:deviceId - delete MFA device

package web

import (
	"context"
	"encoding/base64"
	"net/http"
	"sync"
	"time"

	"github.com/gravitational/trace"

	"github.com/siriusec/siriusec/api/client/proto"
	"github.com/siriusec/siriusec/lib/httplib"
	"github.com/siriusec/siriusec/lib/utils"
	"github.com/sirupsen/logrus"

	"github.com/julienschmidt/httprouter"
)

// MFA session store for multi-step device registration
type mfaSessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*mfaSession
	log      logrus.FieldLogger
}

type mfaSession struct {
	stream    proto.AuthService_AddMFADeviceClient
	cancel    context.CancelFunc
	createdAt time.Time
}

// newMFASessionStore creates a new MFA session store with cleanup goroutine
func newMFASessionStore(log logrus.FieldLogger) *mfaSessionStore {
	store := &mfaSessionStore{
		sessions: make(map[string]*mfaSession),
		log:      log,
	}
	// Start cleanup goroutine to remove stale sessions
	go store.cleanup()
	return store
}

// cleanup removes sessions older than 5 minutes
func (s *mfaSessionStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for key, session := range s.sessions {
			if now.Sub(session.createdAt) > 5*time.Minute {
				if session.cancel != nil {
					session.cancel()
				}
				delete(s.sessions, key)
				s.log.Debugf("Cleaned up expired MFA session: %s", key)
			}
		}
		s.mu.Unlock()
	}
}

// put stores a session
func (s *mfaSessionStore) put(key string, stream proto.AuthService_AddMFADeviceClient, cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = &mfaSession{
		stream:    stream,
		cancel:    cancel,
		createdAt: time.Now(),
	}
}

// get retrieves a session
func (s *mfaSessionStore) get(key string) (*mfaSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[key]
	return session, ok
}

// remove deletes a session
func (s *mfaSessionStore) remove(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, key)
}

// MFADevice represents an MFA device in REST API responses
type MFADevice struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	Type     string     `json:"type"`
	AddedAt  time.Time  `json:"addedAt"`
	LastUsed *time.Time `json:"lastUsed,omitempty"`
}

// MFADeviceListResponse is the response for listing MFA devices
type MFADeviceListResponse struct {
	Devices []MFADevice `json:"devices"`
}

// AddTOTPDeviceRequest is the request for initiating TOTP device registration
type AddTOTPDeviceRequest struct {
	Name string `json:"name"`
}

// AddTOTPDeviceResponse is the response for initiating TOTP device registration
type AddTOTPDeviceResponse struct {
	QRCode string `json:"qrCode"`
	Secret string `json:"secret"`
}

// VerifyTOTPRequest is the request for completing TOTP device registration
type VerifyTOTPRequest struct {
	Token string `json:"token"`
	Code  string `json:"code"`
}

// AddU2FDeviceRequest is the request for initiating U2F device registration
type AddU2FDeviceRequest struct {
	Name string `json:"name"`
}

// AddU2FDeviceResponse is the response for initiating U2F device registration
type AddU2FDeviceResponse struct {
	Challenge U2FChallengeResponse `json:"challenge"`
}

// U2FChallengeResponse represents a U2F challenge
type U2FChallengeResponse struct {
	Version   string `json:"version"`
	Challenge string `json:"challenge"`
	KeyHandle string `json:"keyHandle"`
	AppID     string `json:"appId"`
}

// RegisterU2FDeviceRequest is the request for completing U2F device registration
type RegisterU2FDeviceRequest struct {
	Name                string          `json:"name"`
	U2FRegisterResponse U2FRegisterResp `json:"u2f_register_response"`
}

// U2FRegisterResponse represents the U2F registration response from browser
type U2FRegisterResp struct {
	RegistrationData string `json:"registrationData"`
	ClientData       string `json:"clientData"`
	Challenge        string `json:"challenge"`
}

// DeleteMFADeviceRequest is the request for deleting an MFA device
type DeleteMFADeviceRequest struct {
	TOTPCode string `json:"totpCode,omitempty"`
}

// getMFADevicesHandle handles GET /webapi/mfa/devices
func (h *Handler) getMFADevicesHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	client, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	resp, err := client.GetMFADevices(r.Context(), &proto.GetMFADevicesRequest{})
	if err != nil {
		return nil, trace.Wrap(err)
	}

	devices := make([]MFADevice, 0, len(resp.Devices))
	for _, device := range resp.Devices {
		mfaDevice := MFADevice{
			ID:   device.Id,
			Name: device.GetName(),
			Type: device.MFAType(),
		}
		if !device.AddedAt.IsZero() {
			mfaDevice.AddedAt = device.AddedAt
		}
		if !device.LastUsed.IsZero() {
			mfaDevice.LastUsed = &device.LastUsed
		}
		devices = append(devices, mfaDevice)
	}

	return MFADeviceListResponse{Devices: devices}, nil
}

// addTOTPDeviceHandle handles POST /webapi/mfa/totp
func (h *Handler) addTOTPDeviceHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	var req AddTOTPDeviceRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	if req.Name == "" {
		return nil, trace.BadParameter("name is required")
	}

	client, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	// Open streaming gRPC connection with a background context
	// (not r.Context() which gets cancelled when the HTTP request ends)
	streamCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	stream, err := client.AddMFADevice(streamCtx)
	if err != nil {
		cancel()
		return nil, trace.Wrap(err)
	}

	// Send initialization request
	initReq := &proto.AddMFADeviceRequestInit{
		DeviceName: req.Name,
		Type:       proto.AddMFADeviceRequestInit_TOTP,
	}
	if err := stream.Send(&proto.AddMFADeviceRequest{
		Request: &proto.AddMFADeviceRequest_Init{Init: initReq},
	}); err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	// Receive ExistingMFAChallenge (step 2)
	authChallenge, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	existingChallenge := authChallenge.GetExistingMFAChallenge()
	if existingChallenge != nil && (len(existingChallenge.U2F) > 0 || existingChallenge.TOTP != nil) {
		// User has existing MFA devices and must authenticate before adding a new one.
		// The REST API currently requires the client to provide MFA authentication
		// in a separate step, which is not yet implemented.
		stream.CloseSend()
		cancel()
		return nil, trace.BadParameter("MFA authentication required to add this device")
	}

	// Send empty ExistingMFAResponse (step 3) - required even when challenge is empty
	if err := stream.Send(&proto.AddMFADeviceRequest{
		Request: &proto.AddMFADeviceRequest_ExistingMFAResponse{
			ExistingMFAResponse: &proto.MFAAuthenticateResponse{},
		},
	}); err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	// Receive NewMFARegisterChallenge (step 4)
	registerResp, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	totpChallenge := registerResp.GetNewMFARegisterChallenge().GetTOTP()
	if totpChallenge == nil {
		stream.CloseSend()
		cancel()
		return nil, trace.BadParameter("expected TOTP challenge")
	}

	// Store stream for verification step (keyed by TOTP secret)
	h.mfaSessionStore.put(totpChallenge.Secret, stream, cancel)

	// Generate OTP URL and QR code
	otpURL := utils.GenerateOTPURL("totp", req.Name, map[string][]byte{"secret": []byte(totpChallenge.Secret)})
	qrCodeBytes, err := utils.GenerateQRCode(otpURL)
	if err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	return AddTOTPDeviceResponse{
		QRCode: base64.StdEncoding.EncodeToString(qrCodeBytes),
		Secret: totpChallenge.Secret,
	}, nil
}

// verifyTOTPDeviceHandle handles POST /webapi/mfa/totp/verify
func (h *Handler) verifyTOTPDeviceHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	var req VerifyTOTPRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	if req.Token == "" || req.Code == "" {
		return nil, trace.BadParameter("token and code are required")
	}

	// Retrieve stream from session store (keyed by TOTP secret)
	session, ok := h.mfaSessionStore.get(req.Token)
	if !ok {
		return nil, trace.BadParameter("invalid or expired token")
	}
	defer func() {
		if session.cancel != nil {
			session.cancel()
		}
		h.mfaSessionStore.remove(req.Token)
	}()

	// Send TOTP register response
	if err := session.stream.Send(&proto.AddMFADeviceRequest{
		Request: &proto.AddMFADeviceRequest_NewMFARegisterResponse{
			NewMFARegisterResponse: &proto.MFARegisterResponse{
				Response: &proto.MFARegisterResponse_TOTP{
					TOTP: &proto.TOTPRegisterResponse{Code: req.Code},
				},
			},
		},
	}); err != nil {
		return nil, trace.Wrap(err)
	}

	// Receive acknowledgment
	ack, err := session.stream.Recv()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	// Verify we got an acknowledgment
	if ack.GetAck() == nil {
		return nil, trace.BadParameter("expected acknowledgment")
	}

	if err := session.stream.CloseSend(); err != nil {
		return nil, trace.Wrap(err)
	}

	return map[string]string{}, nil
}

// addU2FDeviceHandle handles POST /webapi/u2f/signuptokens
func (h *Handler) addU2FDeviceHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	var req AddU2FDeviceRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	if req.Name == "" {
		return nil, trace.BadParameter("name is required")
	}

	client, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	// Open streaming gRPC connection with a background context
	streamCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	stream, err := client.AddMFADevice(streamCtx)
	if err != nil {
		cancel()
		return nil, trace.Wrap(err)
	}

	// Send initialization request
	initReq := &proto.AddMFADeviceRequestInit{
		DeviceName: req.Name,
		Type:       proto.AddMFADeviceRequestInit_U2F,
	}
	if err := stream.Send(&proto.AddMFADeviceRequest{
		Request: &proto.AddMFADeviceRequest_Init{Init: initReq},
	}); err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	// Receive response - may contain ExistingMFAChallenge
	authChallenge, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	// Handle existing MFA challenge
	if authChallenge.GetExistingMFAChallenge() != nil {
		if err := stream.Send(&proto.AddMFADeviceRequest{
			Request: &proto.AddMFADeviceRequest_ExistingMFAResponse{
				ExistingMFAResponse: &proto.MFAAuthenticateResponse{},
			},
		}); err != nil {
			stream.CloseSend()
			cancel()
			return nil, trace.Wrap(err)
		}
	}

	// Receive register challenge
	registerResp, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		cancel()
		return nil, trace.Wrap(err)
	}

	u2fChallenge := registerResp.GetNewMFARegisterChallenge().GetU2F()
	if u2fChallenge == nil {
		stream.CloseSend()
		cancel()
		return nil, trace.BadParameter("expected U2F challenge")
	}

	// Store stream for registration step (keyed by U2F challenge)
	h.mfaSessionStore.put(u2fChallenge.Challenge, stream, cancel)

	// U2F keyHandle is empty for registration (only used for authentication)
	return AddU2FDeviceResponse{
		Challenge: U2FChallengeResponse{
			Version:   u2fChallenge.Version,
			Challenge: u2fChallenge.Challenge,
			KeyHandle: "",
			AppID:     u2fChallenge.AppID,
		},
	}, nil
}

// registerU2FDeviceHandle handles POST /webapi/mfa/u2f
func (h *Handler) registerU2FDeviceHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	var req RegisterU2FDeviceRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	if req.Name == "" || req.U2FRegisterResponse.Challenge == "" {
		return nil, trace.BadParameter("name and challenge are required")
	}

	// Retrieve stream from session store (keyed by U2F challenge)
	session, ok := h.mfaSessionStore.get(req.U2FRegisterResponse.Challenge)
	if !ok {
		return nil, trace.BadParameter("invalid or expired challenge")
	}
	defer func() {
		if session.cancel != nil {
			session.cancel()
		}
		h.mfaSessionStore.remove(req.U2FRegisterResponse.Challenge)
	}()

	// Send U2F register response
	if err := session.stream.Send(&proto.AddMFADeviceRequest{
		Request: &proto.AddMFADeviceRequest_NewMFARegisterResponse{
			NewMFARegisterResponse: &proto.MFARegisterResponse{
				Response: &proto.MFARegisterResponse_U2F{
					U2F: &proto.U2FRegisterResponse{
						RegistrationData: req.U2FRegisterResponse.RegistrationData,
						ClientData:       req.U2FRegisterResponse.ClientData,
					},
				},
			},
		},
	}); err != nil {
		return nil, trace.Wrap(err)
	}

	// Receive acknowledgment
	ack, err := session.stream.Recv()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	// Verify we got an acknowledgment
	if ack.GetAck() == nil {
		return nil, trace.BadParameter("expected acknowledgment")
	}

	if err := session.stream.CloseSend(); err != nil {
		return nil, trace.Wrap(err)
	}

	return map[string]string{}, nil
}

// deleteMFADeviceHandle handles DELETE /webapi/mfa/devices/:deviceId
func (h *Handler) deleteMFADeviceHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	deviceID := params.ByName("deviceId")
	if deviceID == "" {
		return nil, trace.BadParameter("deviceId is required")
	}

	var req DeleteMFADeviceRequest
	if r.ContentLength > 0 {
		if err := httplib.ReadJSON(r, &req); err != nil {
			return nil, trace.Wrap(err)
		}
	}
	if req.TOTPCode == "" {
		req.TOTPCode = r.URL.Query().Get("totpCode")
	}

	client, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	// Get all devices to find the device name from ID
	devicesResp, err := client.GetMFADevices(r.Context(), &proto.GetMFADevicesRequest{})
	if err != nil {
		return nil, trace.Wrap(err)
	}

	var deviceName string
	for _, device := range devicesResp.Devices {
		if device.Id == deviceID {
			deviceName = device.GetName()
			break
		}
	}

	if deviceName == "" {
		return nil, trace.NotFound("device %s not found", deviceID)
	}

	// Open streaming gRPC connection for delete with a background context
	streamCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	stream, err := client.DeleteMFADevice(streamCtx)
	if err != nil {
		cancel()
		return nil, trace.Wrap(err)
	}
	defer cancel()

	// Send initialization request
	initReq := &proto.DeleteMFADeviceRequestInit{
		DeviceName: deviceName,
	}
	if err := stream.Send(&proto.DeleteMFADeviceRequest{
		Request: &proto.DeleteMFADeviceRequest_Init{Init: initReq},
	}); err != nil {
		stream.CloseSend()
		return nil, trace.Wrap(err)
	}

	// Receive MFAChallenge (step 2) - server always sends this even if empty
	deleteResp, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		return nil, trace.Wrap(err)
	}

	var mfaResponse *proto.MFAAuthenticateResponse
	existingChallenge := deleteResp.GetMFAChallenge()
	if existingChallenge != nil && (len(existingChallenge.U2F) > 0 || existingChallenge.TOTP != nil) {
		if req.TOTPCode == "" {
			stream.CloseSend()
			return nil, trace.BadParameter("MFA authentication required to delete this device; provide totpCode")
		}
		mfaResponse = &proto.MFAAuthenticateResponse{
			Response: &proto.MFAAuthenticateResponse_TOTP{
				TOTP: &proto.TOTPResponse{Code: req.TOTPCode},
			},
		}
	} else {
		mfaResponse = &proto.MFAAuthenticateResponse{}
	}

	// Send MFAResponse (step 3) - required even when challenge is empty
	if err := stream.Send(&proto.DeleteMFADeviceRequest{
		Request: &proto.DeleteMFADeviceRequest_MFAResponse{
			MFAResponse: mfaResponse,
		},
	}); err != nil {
		stream.CloseSend()
		return nil, trace.Wrap(err)
	}

	// Receive acknowledgment (step 4)
	ack, err := stream.Recv()
	if err != nil {
		stream.CloseSend()
		return nil, trace.Wrap(err)
	}

	// Verify we got an acknowledgment
	if ack.GetAck() == nil {
		return nil, trace.BadParameter("expected acknowledgment")
	}

	if err := stream.CloseSend(); err != nil {
		return nil, trace.Wrap(err)
	}

	return map[string]string{}, nil
}
