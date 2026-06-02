/*
Copyright 2026 Siriusec

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

package web

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/siriusec/siriusec/api/types"
	"github.com/siriusec/siriusec/lib/httplib"

	"github.com/gravitational/trace"
	"github.com/julienschmidt/httprouter"
)

type accessRequestResponse struct {
	ID             string   `json:"id"`
	User           string   `json:"user"`
	Roles          []string `json:"roles"`
	State          string   `json:"state"`
	Created        string   `json:"created"`
	Expires        string   `json:"expires"`
	RequestReason  string   `json:"requestReason,omitempty"`
	ResolveReason  string   `json:"resolveReason,omitempty"`
	ResolveTime    string   `json:"resolveTime,omitempty"`
	RequestedBy    string   `json:"requestedBy,omitempty"`
	Reviews        []accessReviewResponse `json:"reviews,omitempty"`
	SuggestedReviewers []string `json:"suggestedReviewers,omitempty"`
}

type accessReviewResponse struct {
	Author        string   `json:"author"`
	ProposedState string   `json:"proposedState"`
	Reason        string   `json:"reason,omitempty"`
	Created       string   `json:"created,omitempty"`
}

type createAccessRequestRequest struct {
	Roles  []string `json:"roles"`
	Reason string   `json:"reason"`
}

type reviewAccessRequestRequest struct {
	RequestID string `json:"request_id"`
	Approved  bool   `json:"approved"`
	Reason    string `json:"reason"`
}

func newAccessRequestResponse(req types.AccessRequest) accessRequestResponse {
	resp := accessRequestResponse{
		ID:        req.GetName(),
		User:      req.GetUser(),
		Roles:     req.GetRoles(),
		State:     req.GetState().String(),
		Created:   req.GetCreationTime().UTC().Format("2006-01-02T15:04:05Z"),
		Expires:   req.GetAccessExpiry().UTC().Format("2006-01-02T15:04:05Z"),
		RequestReason:  req.GetRequestReason(),
		ResolveReason:  req.GetResolveReason(),
		RequestedBy:    req.GetUser(),
		SuggestedReviewers: req.GetSuggestedReviewers(),
	}

	if resolveTime := req.GetResolveTime(); !resolveTime.IsZero() {
		resp.ResolveTime = resolveTime.UTC().Format("2006-01-02T15:04:05Z")
	}

	reviews := req.GetReviews()
	resp.Reviews = make([]accessReviewResponse, 0, len(reviews))
	for _, r := range reviews {
		resp.Reviews = append(resp.Reviews, accessReviewResponse{
			Author:        r.Author,
			ProposedState: r.ProposedState.String(),
			Reason:        r.Reason,
			Created:       r.Created.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}

	return resp
}

func (h *Handler) getAccessRequestsHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	requests, err := clt.GetAccessRequests(r.Context(), types.AccessRequestFilter{})
	if err != nil {
		return nil, trace.Wrap(err)
	}

	items := make([]accessRequestResponse, 0, len(requests))
	for _, req := range requests {
		items = append(items, newAccessRequestResponse(req))
	}
	return items, nil
}

func (h *Handler) getPendingAccessRequestsHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	requests, err := clt.GetAccessRequests(r.Context(), types.AccessRequestFilter{
		State: types.RequestState_PENDING,
	})
	if err != nil {
		return nil, trace.Wrap(err)
	}

	items := make([]accessRequestResponse, 0, len(requests))
	for _, req := range requests {
		items = append(items, newAccessRequestResponse(req))
	}
	return items, nil
}

func (h *Handler) getMyAccessRequestsHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	user := ctx.GetUser()

	requests, err := clt.GetAccessRequests(r.Context(), types.AccessRequestFilter{
		User: user,
	})
	if err != nil {
		return nil, trace.Wrap(err)
	}

	items := make([]accessRequestResponse, 0, len(requests))
	for _, req := range requests {
		items = append(items, newAccessRequestResponse(req))
	}
	return items, nil
}

func (h *Handler) createAccessRequestHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	var req createAccessRequestRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}
	if len(req.Roles) == 0 {
		return nil, trace.BadParameter("missing roles")
	}

	user := ctx.GetUser()

	accessReq, err := types.NewAccessRequest(uuid.New().String(), user, req.Roles...)
	if err != nil {
		return nil, trace.Wrap(err)
	}

	accessReq.SetRequestReason(req.Reason)

	if err := clt.CreateAccessRequest(r.Context(), accessReq); err != nil {
		return nil, trace.Wrap(err)
	}

	return newAccessRequestResponse(accessReq), nil
}

func (h *Handler) reviewAccessRequestHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	var req reviewAccessRequestRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}
	if req.RequestID == "" {
		return nil, trace.BadParameter("missing request ID")
	}

	user := ctx.GetUser()

	proposedState := types.RequestState_DENIED
	if req.Approved {
		proposedState = types.RequestState_APPROVED
	}

	submission := types.AccessReviewSubmission{
		RequestID: req.RequestID,
		Review: types.AccessReview{
			Author:        user,
			ProposedState: proposedState,
			Reason:        req.Reason,
		},
	}

	updated, err := clt.SubmitAccessReview(r.Context(), submission)
	if err != nil {
		return nil, trace.Wrap(err)
	}

	return newAccessRequestResponse(updated), nil
}
