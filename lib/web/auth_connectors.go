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
	"context"
	"encoding/json"
	"net/http"

	"github.com/siriusec/siriusec/api/types"
	"github.com/siriusec/siriusec/lib/httplib"
	"github.com/siriusec/siriusec/lib/services"
	"github.com/siriusec/siriusec/lib/web/ui"

	"github.com/gravitational/trace"
	"github.com/julienschmidt/httprouter"
)

type authConnectorType string

const (
	connectorTypeGithub authConnectorType = "github"
	connectorTypeOIDC   authConnectorType = "oidc"
	connectorTypeSAML   authConnectorType = "saml"
)

func parseConnectorType(s string) (authConnectorType, error) {
	switch authConnectorType(s) {
	case connectorTypeGithub, connectorTypeOIDC, connectorTypeSAML:
		return authConnectorType(s), nil
	default:
		return "", trace.BadParameter("invalid connector type %q, must be github, oidc, or saml", s)
	}
}

func (h *Handler) getAuthConnectorsHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}
	return getAllAuthConnectors(r.Context(), clt)
}

func (h *Handler) getAuthConnectorsByTypeHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	connectorType, err := parseConnectorType(params.ByName("type"))
	if err != nil {
		return nil, trace.Wrap(err)
	}

	return getAuthConnectorsByType(r.Context(), clt, connectorType)
}

func (h *Handler) getAuthConnectorHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	connectorType, err := parseConnectorType(params.ByName("type"))
	if err != nil {
		return nil, trace.Wrap(err)
	}

	name := params.ByName("name")
	return getAuthConnector(r.Context(), clt, connectorType, name)
}

func (h *Handler) upsertAuthConnectorHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	var req ui.ResourceItem
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	connectorTypeParam := params.ByName("type")
	if connectorTypeParam != "" {
		if _, err := parseConnectorType(connectorTypeParam); err != nil {
			return nil, trace.Wrap(err)
		}
	}

	return upsertAuthConnector(r.Context(), clt, req.Content, r.Method)
}

func (h *Handler) deleteAuthConnectorHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	connectorType, err := parseConnectorType(params.ByName("type"))
	if err != nil {
		return nil, trace.Wrap(err)
	}

	name := params.ByName("name")
	return deleteAuthConnector(r.Context(), clt, connectorType, name)
}

func (h *Handler) testAuthConnectorHandle(w http.ResponseWriter, r *http.Request, params httprouter.Params, ctx *SessionContext) (interface{}, error) {
	clt, err := ctx.GetClient()
	if err != nil {
		return nil, trace.Wrap(err)
	}

	var req testAuthConnectorRequest
	if err := httplib.ReadJSON(r, &req); err != nil {
		return nil, trace.Wrap(err)
	}

	return testAuthConnector(r.Context(), clt, req)
}

type testAuthConnectorRequest struct {
	Connector struct {
		Kind     string          `json:"kind"`
		Version  string          `json:"version"`
		Metadata types.Metadata  `json:"metadata"`
		Spec     json.RawMessage `json:"spec"`
	} `json:"connector"`
}

type testAuthConnectorResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message,omitempty"`
	User    *testAuthUser    `json:"user,omitempty"`
}

type testAuthUser struct {
	Name   string              `json:"name"`
	Roles  []string            `json:"roles"`
	Traits map[string][]string `json:"traits,omitempty"`
}

func getAllAuthConnectors(ctx context.Context, clt authConnectorsGetter) ([]ui.ResourceItem, error) {
	var items []ui.ResourceItem

	githubConnectors, err := clt.GetGithubConnectors(ctx, false)
	if err != nil && !trace.IsNotFound(err) {
		return nil, trace.Wrap(err)
	}
	for _, c := range githubConnectors {
		item, err := ui.NewResourceItem(c)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		items = append(items, *item)
	}

	oidcConnectors, err := clt.GetOIDCConnectors(ctx, false)
	if err != nil && !trace.IsNotFound(err) {
		return nil, trace.Wrap(err)
	}
	for _, c := range oidcConnectors {
		item, err := ui.NewResourceItem(c)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		items = append(items, *item)
	}

	samlConnectors, err := clt.GetSAMLConnectors(ctx, false)
	if err != nil && !trace.IsNotFound(err) {
		return nil, trace.Wrap(err)
	}
	for _, c := range samlConnectors {
		item, err := ui.NewResourceItem(c)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		items = append(items, *item)
	}

	return items, nil
}

func getAuthConnectorsByType(ctx context.Context, clt authConnectorsGetter, connectorType authConnectorType) ([]ui.ResourceItem, error) {
	switch connectorType {
	case connectorTypeGithub:
		connectors, err := clt.GetGithubConnectors(ctx, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewGithubConnectors(connectors)
	case connectorTypeOIDC:
		connectors, err := clt.GetOIDCConnectors(ctx, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewOIDCConnectors(connectors)
	case connectorTypeSAML:
		connectors, err := clt.GetSAMLConnectors(ctx, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewSAMLConnectors(connectors)
	default:
		return nil, trace.BadParameter("unsupported connector type %q", connectorType)
	}
}

func getAuthConnector(ctx context.Context, clt authConnectorsGetter, connectorType authConnectorType, name string) (*ui.ResourceItem, error) {
	switch connectorType {
	case connectorTypeGithub:
		connector, err := clt.GetGithubConnector(ctx, name, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)
	case connectorTypeOIDC:
		connector, err := clt.GetOIDCConnector(ctx, name, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)
	case connectorTypeSAML:
		connector, err := clt.GetSAMLConnector(ctx, name, false)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)
	default:
		return nil, trace.BadParameter("unsupported connector type %q", connectorType)
	}
}

func upsertAuthConnector(ctx context.Context, clt authConnectorsGetter, content, httpMethod string) (*ui.ResourceItem, error) {
	extractedRes, err := ExtractResourceAndValidate(content)
	if err != nil {
		return nil, trace.Wrap(err)
	}

	switch extractedRes.Kind {
	case types.KindGithubConnector:
		_, err = clt.GetGithubConnector(ctx, extractedRes.Metadata.Name, false)
		if err := CheckResourceUpsertableByError(err, httpMethod, extractedRes.Metadata.Name); err != nil {
			return nil, trace.Wrap(err)
		}
		connector, err := services.UnmarshalGithubConnector(extractedRes.Raw)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		if err := clt.UpsertGithubConnector(ctx, connector); err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)

	case types.KindOIDCConnector:
		_, err = clt.GetOIDCConnector(ctx, extractedRes.Metadata.Name, false)
		if err := CheckResourceUpsertableByError(err, httpMethod, extractedRes.Metadata.Name); err != nil {
			return nil, trace.Wrap(err)
		}
		connector, err := services.UnmarshalOIDCConnector(extractedRes.Raw)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		if err := clt.UpsertOIDCConnector(ctx, connector); err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)

	case types.KindSAMLConnector:
		_, err = clt.GetSAMLConnector(ctx, extractedRes.Metadata.Name, false)
		if err := CheckResourceUpsertableByError(err, httpMethod, extractedRes.Metadata.Name); err != nil {
			return nil, trace.Wrap(err)
		}
		connector, err := services.UnmarshalSAMLConnector(extractedRes.Raw)
		if err != nil {
			return nil, trace.Wrap(err)
		}
		if err := clt.UpsertSAMLConnector(ctx, connector); err != nil {
			return nil, trace.Wrap(err)
		}
		return ui.NewResourceItem(connector)

	default:
		return nil, trace.BadParameter("resource kind %q is not a valid auth connector", extractedRes.Kind)
	}
}

func deleteAuthConnector(ctx context.Context, clt authConnectorsGetter, connectorType authConnectorType, name string) (interface{}, error) {
	switch connectorType {
	case connectorTypeGithub:
		if err := clt.DeleteGithubConnector(ctx, name); err != nil {
			return nil, trace.Wrap(err)
		}
	case connectorTypeOIDC:
		if err := clt.DeleteOIDCConnector(ctx, name); err != nil {
			return nil, trace.Wrap(err)
		}
	case connectorTypeSAML:
		if err := clt.DeleteSAMLConnector(ctx, name); err != nil {
			return nil, trace.Wrap(err)
		}
	default:
		return nil, trace.BadParameter("unsupported connector type %q", connectorType)
	}
	return OK(), nil
}

func testAuthConnector(ctx context.Context, clt authConnectorsGetter, req testAuthConnectorRequest) (interface{}, error) {
	resource := map[string]interface{}{
		"kind":     req.Connector.Kind,
		"version":  req.Connector.Version,
		"metadata": req.Connector.Metadata,
		"spec":     req.Connector.Spec,
	}
	bytes, err := json.Marshal(resource)
	if err != nil {
		return &testAuthConnectorResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	var connector types.Resource
	switch req.Connector.Kind {
	case types.KindGithubConnector:
		connector, err = services.UnmarshalGithubConnector(bytes)
	case types.KindOIDCConnector:
		connector, err = services.UnmarshalOIDCConnector(bytes)
	case types.KindSAMLConnector:
		connector, err = services.UnmarshalSAMLConnector(bytes)
	default:
		return &testAuthConnectorResponse{
			Success: false,
			Message: "unsupported connector kind: " + req.Connector.Kind,
		}, nil
	}

	if err != nil {
		return &testAuthConnectorResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &testAuthConnectorResponse{
		Success: true,
		Message: "connector configuration is valid",
		User: &testAuthUser{
			Name:  connector.GetName(),
			Roles: []string{"test-role"},
		},
	}, nil
}

type authConnectorsGetter interface {
	GetGithubConnectors(ctx context.Context, withSecrets bool) ([]types.GithubConnector, error)
	GetGithubConnector(ctx context.Context, id string, withSecrets bool) (types.GithubConnector, error)
	UpsertGithubConnector(ctx context.Context, connector types.GithubConnector) error
	DeleteGithubConnector(ctx context.Context, id string) error
	GetOIDCConnectors(ctx context.Context, withSecrets bool) ([]types.OIDCConnector, error)
	GetOIDCConnector(ctx context.Context, id string, withSecrets bool) (types.OIDCConnector, error)
	UpsertOIDCConnector(ctx context.Context, connector types.OIDCConnector) error
	DeleteOIDCConnector(ctx context.Context, id string) error
	GetSAMLConnectors(ctx context.Context, withSecrets bool) ([]types.SAMLConnector, error)
	GetSAMLConnector(ctx context.Context, id string, withSecrets bool) (types.SAMLConnector, error)
	UpsertSAMLConnector(ctx context.Context, connector types.SAMLConnector) error
	DeleteSAMLConnector(ctx context.Context, id string) error
}
