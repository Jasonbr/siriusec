# Siriusec API Gap Analysis

**Generated:** 2026-05-27  
**Version:** 1.0  
**Status:** Analysis Complete, Implementation Required

## Executive Summary

Analyzed frontend API client expectations vs backend API implementations. Found **5 completely missing endpoint groups** affecting MFA, Auth Connectors, Access Requests, System Config, and Token Management. Also discovered **6 path mismatches** and **12 unused backend endpoints**.

---

## 1. Completely Missing Endpoint Groups (CRITICAL)

These endpoint groups are called by frontend but have **no backend implementation**:

### 1.1 MFA Device Management (6 endpoints)
**Frontend calls:**
```typescript
mfaApi.getDevices(clusterName)           // GET /v1/webapi/mfas/{cluster}/devices
mfaApi.challengeU2F(clusterName, req)    // POST /v1/webapi/mfas/{cluster}/challenges/u2f
mfaApi.registerU2F(clusterName, req)     // POST /v1/webapi/mfas/{cluster}/devices/u2f
mfaApi.addTOTPDevice(clusterName, req)   // POST /v1/webapi/mfas/{cluster}/devices/totp
mfaApi.verifyTOTP(clusterName, req)      // POST /v1/webapi/mfas/{cluster}/challenges/totp
mfaApi.deleteDevice(clusterName, id)     // DELETE /v1/webapi/mfas/{cluster}/devices/{id}
```

**Status:** ❌ No implementation in `lib/web/apiserver.go`  
**Impact:** MFA device management UI will fail completely

---

### 1.2 Auth Connectors (7 endpoints)
**Frontend calls:**
```typescript
authConnectorsApi.list(clusterName)      // GET /v1/webapi/authconnectors/{cluster}
authConnectorsApi.get(clusterName, id)   // GET /v1/webapi/authconnectors/{cluster}/{id}
authConnectorsApi.create(clusterName, r) // POST /v1/webapi/authconnectors/{cluster}
authConnectorsApi.update(clusterName, r) // PUT /v1/webapi/authconnectors/{cluster}/{id}
authConnectorsApi.delete(clusterName, id) // DELETE /v1/webapi/authconnectors/{cluster}/{id}
authConnectorsApi.test(clusterName, r)   // POST /v1/webapi/authconnectors/{cluster}/{id}/test
```

**Status:** ❌ No implementation  
**Impact:** SSO configuration page will fail

---

### 1.3 Access Requests (6 endpoints)
**Frontend calls:**
```typescript
accessRequestsApi.list(clusterName, filters)  // GET /v1/webapi/accessrequests/{cluster}
accessRequestsApi.get(clusterName, id)        // GET /v1/webapi/accessrequests/{cluster}/{id}
accessRequestsApi.create(clusterName, req)    // POST /v1/webapi/accessrequests/{cluster}
accessRequestsApi.review(clusterName, id, req) // POST /v1/webapi/accessrequests/{cluster}/{id}/review
accessRequestsApi.cancel(clusterName, id)     // DELETE /v1/webapi/accessrequests/{cluster}/{id}
```

**Status:** ❌ No implementation  
**Impact:** Access request workflow completely broken

---

### 1.4 System Config (3 endpoints)
**Frontend calls:**
```typescript
systemConfigApi.getConfig()      // GET /v1/webapi/system/config
systemConfigApi.updateConfig(c)  // PUT /v1/webapi/system/config
systemConfigApi.reset()          // POST /v1/webapi/system/config/reset
```

**Status:** ❌ No implementation  
**Impact:** System settings page will fail

---

### 1.5 Token Management (4 endpoints)
**Frontend calls:**
```typescript
tokensApi.list(clusterName)      // GET /v1/tokens/{cluster}
tokensApi.get(clusterName, id)   // GET /v1/tokens/{cluster}/{id}
tokensApi.create(clusterName, r) // POST /v1/tokens/{cluster}
tokensApi.revoke(clusterName, id) // DELETE /v1/tokens/{cluster}/{id}
```

**Status:** ❌ Backend has `/v1/tokens` but **only in internal auth server**, not exposed via web proxy  
**Impact:** Token management UI will fail (404 errors)

---

## 2. Path Mismatches (HIGH PRIORITY)

Backend exists but path doesn't match frontend expectations:

### 2.1 Trusted Clusters
```
Frontend expects: /v1/webapi/trustedcluster/{cluster}     (singular)
Backend has:      /v1/webapi/trustedclusters/{cluster}    (plural)
```
**Fix:** Update frontend `authConnectorsApi` to use plural form

### 2.2 U2F Registration
```
Frontend expects: /v1/webapi/mfas/{cluster}/devices/u2f/register
Backend has:      /v1/webapi/mfas/{cluster}/u2f/register
```
**Fix:** Remove `/devices` from path

### 2.3 Session Join
```
Frontend expects: /v1/webapi/sessions/{cluster}/{id}/join
Backend has:      /v1/webapi/sessions/{cluster}/join (query param: session_id)
```
**Fix:** Change to query parameter approach

### 2.4 Session Renew
```
Frontend expects: /v1/webapi/sessions/{cluster}/{id}/renew
Backend has:      /v1/webapi/sessions/{cluster}/renew (query param: session_id)
```
**Fix:** Change to query parameter approach

### 2.5 Session End
```
Frontend expects: /v1/webapi/sessions/{cluster}/{id}/end
Backend has:      /v1/webapi/sessions/{cluster}/end (query param: session_id)
```
**Fix:** Change to query parameter approach

### 2.6 Session Replay
```
Frontend expects: /v1/webapi/sessions/{cluster}/{id}/replay
Backend has:      /v1/webapi/sessions/{cluster}/replay (query param: session_id)
```
**Fix:** Change to query parameter approach

---

## 3. Backend Endpoints Not Used by Frontend (12 endpoints)

These backend endpoints have no corresponding frontend calls:

```
GET    /v1/webapi/audit/{cluster}/stats          - Audit statistics
POST   /v1/webapi/audit/{cluster}/export         - Export audit logs
GET    /v1/webapi/nodes/{cluster}/shell          - Node shell access
POST   /v1/webapi/apps/{cluster}/deploy          - Deploy app
POST   /v1/webapi/apps/{cluster}/{id}/restart    - Restart app
POST   /v1/webapi/apps/{cluster}/{id}/stop       - Stop app
POST   /v1/webapi/apps/{cluster}/{id}/start      - Start app
GET    /v1/webapi/databases/{cluster}/backup     - Database backup list
POST   /v1/webapi/databases/{cluster}/backup     - Create backup
POST   /v1/webapi/databases/{cluster}/restore    - Restore from backup
GET    /v1/webapi/kubernetes/{cluster}/health    - K8s health check
POST   /v1/webapi/kubernetes/{cluster}/apply     - Apply K8s manifest
```

**Recommendation:** Either implement frontend features or remove backend endpoints

---

## 4. Implementation Priority

### Phase 1: Critical (Blockers)
1. **MFA Device Management** - 6 endpoints
2. **Auth Connectors** - 7 endpoints
3. **Access Requests** - 6 endpoints

### Phase 2: High Priority
4. **System Config** - 3 endpoints
5. **Token Management** - 4 endpoints (requires web proxy exposure)
6. **Fix Path Mismatches** - 6 corrections

### Phase 3: Nice to Have
7. Implement or remove 12 unused backend endpoints

---

## 5. Technical Notes

### 5.1 Token API Special Case
```go
// Backend has tokens API but only in internal auth server:
// pkg/auth/server/server.go (lines 120-180)

// NOT exposed in web proxy:
// lib/web/proxy/proxy.go - no /v1/tokens routes
```

**Required:** Add token routes to web proxy or move implementation to apiserver

### 5.2 Session Operations Pattern
Backend uses query parameters for session ID in operations:
```go
// Backend pattern:
http.HandleFunc("/v1/webapi/sessions/"+clusterName+"/join", joinHandler)
// Expects: ?session_id=xxx

// Frontend expects:
/v1/webapi/sessions/{cluster}/{sessionId}/join
```

**Required:** Update frontend to match backend's query param pattern

---

## 6. Files to Modify

### Backend (New Implementations)
- `lib/web/apiserver.go` - Add missing handlers
- `pkg/mfa/` - Create MFA device management
- `pkg/authconnector/` - Create connector management
- `pkg/accessrequest/` - Create access request workflow
- `pkg/config/` - Create system config management

### Frontend (Path Corrections)
- `src/api/client.ts` - Fix 6 path mismatches
- `src/pages/MFADevices.tsx` - Will work once backend implemented
- `src/pages/AuthConnectors.tsx` - Will work once backend implemented
- `src/pages/AccessRequests.tsx` - Will work once backend implemented
- `src/pages/SystemSettings.tsx` - Will work once backend implemented

---

## 7. Testing Recommendations

1. **Unit Tests:** Add tests for all new backend handlers
2. **Integration Tests:** Test full request/response cycles
3. **E2E Tests:** Test UI workflows after backend implementation
4. **Load Tests:** Verify MFA and auth connector performance

---

## 8. Next Steps

1. ✅ Analysis complete
2. ⏳ Create implementation plan
3. ⏳ Implement Phase 1 endpoints
4. ⏳ Fix path mismatches
5. ⏳ Implement Phase 2-3 endpoints
6. ⏳ Add comprehensive tests
7. ⏳ Deploy and verify

---

**Total Endpoints to Implement:** 26 new + 6 path fixes = **32 changes required**

**Estimated Effort:** 
- Phase 1: 3-4 days
- Phase 2: 2-3 days  
- Phase 3: 1-2 days (optional)

**Total:** 6-9 days of development
