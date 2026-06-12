// API 响应类型定义

export interface LoginRequest {
  user: string;
  pass: string;
  second_factor_token?: string;
}

export interface LoginResponse {
  type: 'Bearer';
  token: string;
  expires_in: number;
  sessionExpires: string;
  sessionInactiveTimeout: number;
  clusterName?: string;
}

export interface UserContext {
  authType: 'local' | 'sso';
  userName: string;
  userAcl: ACL;
  cluster: Cluster;
  accessStrategy: {
    type: 'optional' | 'reason' | 'always';
    prompt: string;
  };
  accessCapabilities: {
    requestableRoles: string[] | null;
    suggestedReviewers: string[] | null;
  };
}

export interface ACL {
  sessions: AccessLevel;
  authConnectors: AccessLevel;
  roles: AccessLevel;
  users: AccessLevel;
  trustedClusters: AccessLevel;
  events: AccessLevel;
  tokens: AccessLevel;
  nodes: AccessLevel;
  appServers: AccessLevel;
  dbServers: AccessLevel;
  kubeServers: AccessLevel;
  sshLogins: string[];
  accessRequests: AccessLevel;
  billing: AccessLevel;
}

export interface AccessLevel {
  list: boolean;
  read: boolean;
  edit: boolean;
  create: boolean;
  delete: boolean;
}

export interface Cluster {
  name: string;
  lastConnected: string;
  status: 'online' | 'offline';
  nodeCount: number;
  publicURL: string;
  authVersion: string;
  proxyVersion: string;
}

export interface Node {
  id: string;
  siteId: string;
  hostname: string;
  addr: string;
  tunnel: boolean;
  tags: Label[];
}

export interface Label {
  name: string;
  value: string;
}

export interface User {
  name: string;
  roles: string[];
  authType: 'local' | 'oidc' | 'saml' | 'github';
}

export interface Role {
  id: string;
  kind: 'role';
  name: string;
  content: string;
}

export interface AuditEvent {
  cluster_name: string;
  code: string;
  ei: number;
  event: string;
  time: string;
  uid: string;
  user?: string;
  method?: string;
  success?: boolean;
  // 其他事件特定字段
  [key: string]: any;
}

export interface Namespace {
  kind: 'namespace';
  version: 'v2';
  metadata: {
    name: string;
    id: number;
  };
  spec: Record<string, any>;
}

export interface Session {
  id: string;
  namespace: string;
  server_id: string;
  server_hostname: string;
  login: string;
  created: string;
  last_active: string;
  terminal_params: {
    w: number;
    h: number;
  };
  parties?: Party[];
}

export interface Party {
  user: string;
  server_addr: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  bearerToken: string | null;
  csrfToken: string | null;
  user: UserContext | null;
}

export interface ApiError {
  error: {
    message: string;
  };
  message: string;
  traces?: Array<{
    path: string;
    func: string;
    line: number;
  }>;
}

// 应用服务器类型
export interface AppServer {
  name: string;
  description: string;
  uri: string;
  publicAddr: string;
  fqdn: string;
  clusterId: string;
  labels: Label[];
  awsConsole: boolean;
}

// 数据库服务器类型
export interface DatabaseServer {
  name: string;
  desc: string;
  protocol: string;
  type: string;
  labels: Label[];
}

// Kubernetes 集群类型
export interface KubernetesCluster {
  name: string;
  labels: Label[];
}

// ==========================================
// 新增类型 - 密码修改
// ==========================================

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  second_factor_token?: string;
  u2f_sign_response?: {
    keyHandle: string;
    signatureData: string;
    clientData: string;
  };
}

export interface ChangePasswordResponse {
  message: string;
}

// ==========================================
// 新增类型 - 密码重置/邀请
// ==========================================

export interface CreateResetPasswordTokenRequest {
  name: string;
  type: 'invite' | 'password';
}

export interface ResetPasswordToken {
  tokenId: string;
  user: string;
  qrCode?: string;
  expiry?: string;
}

export interface ChangePasswordWithTokenRequest {
  token: string;
  password: string;
  second_factor_token?: string;
  u2f_register_response?: unknown;
}

// ==========================================
// 新增类型 - 创建会话
// ==========================================

export interface CreateSessionRequest {
  session: {
    server_id: string;
    login: string;
    terminal_params: {
      w: number;
      h: number;
    };
  };
}

export interface CreateSessionResponse {
  session: Session;
}

// ==========================================
// 新增类型 - SSO 和认证设置
// ==========================================

export interface PingResponse {
  auth: AuthenticationSettings;
  proxy: {
    publicAddr: string;
  };
  server_version: string;
  min_client_version: string;
}

export interface AuthenticationSettings {
  type: 'local' | 'oidc' | 'saml' | 'github' | string;
  second_factor: 'off' | 'on' | 'otp' | 'u2f' | 'webauthn';
  local: {
    name: string;
  } | null;
  oidc: SSOConnector[];
  saml: SSOConnector[];
  github: SSOConnector[];
  u2f: {
    app_id: string;
  } | null;
}

export interface SSOConnector {
  name: string;
  display: string;
}

// ==========================================
// 新增类型 - MFA/2FA 设备管理
// ==========================================

export interface MFADevice {
  id: string;
  name: string;
  type: 'totp' | 'u2f' | 'webauthn';
  addedAt: string;
  lastUsed?: string;
}

export interface U2FChallengeResponse {
  version: string;
  challenge: string;
  keyHandle: string;
  appId: string;
}

export interface U2FSignResponse {
  signatureData: string;
  clientData: string;
  challenge: string;
}

export interface MFAChallengeRequest {
  user: string;
  pass: string;
}

export interface MFAChallengeResponse {
  version: string;
  challenge: string;
  keyHandle: string;
  appId: string;
}

export interface CreateU2FSessionRequest {
  user: string;
  u2f_sign_response: U2FSignResponse;
}

export interface AddTOTPDeviceRequest {
  name: string;
}

export interface AddTOTPDeviceResponse {
  qrCode: string;
  secret: string;
}

export interface VerifyTOTPRequest {
  token: string;
  code: string;
}

export interface AddU2FDeviceRequest {
  name: string;
}

export interface AddU2FDeviceResponse {
  challenge: U2FChallengeResponse;
}

export interface RegisterU2FDeviceRequest {
  name: string;
  u2f_register_response: {
    registrationData: string;
    clientData: string;
    challenge: string;
  };
}

// ==========================================
// 新增类型 - 认证连接器管理
// ==========================================

export interface AuthConnector {
  kind: 'oidc' | 'saml' | 'github';
  version: 'v2' | 'v3';
  metadata: {
    name: string;
    namespace?: string;
    description?: string;
    labels?: Record<string, string>;
    display?: string;
  };
  spec: OIDCConnectorSpec | SAMLConnectorSpec | GitHubConnectorSpec;
}

export interface OIDCConnectorSpec {
  issuer_url: string;
  client_id: string;
  client_secret?: string;
  redirect_url?: string;
  scopes?: string[];
  claims_to_roles?: ClaimMapping[];
  display?: string;
  prompt?: string;
}

export interface SAMLConnectorSpec {
  acs: string;
  entity_descriptor?: string;
  entity_descriptor_url?: string;
  display?: string;
  attributes_to_roles?: AttributeMapping[];
  signing_key_pair?: SigningKeyPair;
}

export interface GitHubConnectorSpec {
  client_id: string;
  client_secret?: string;
  redirect_url?: string;
  display?: string;
  teams_to_roles?: TeamMapping[];
}

export interface ClaimMapping {
  claim: string;
  value?: string;
  roles: string[];
}

export interface AttributeMapping {
  name: string;
  value?: string;
  roles: string[];
}

export interface TeamMapping {
  organization: string;
  team?: string;
  roles: string[];
}

export interface SigningKeyPair {
  private_key: string;
  cert: string;
}

export interface CreateAuthConnectorRequest {
  connector: AuthConnector;
}

export interface UpdateAuthConnectorRequest {
  connector: AuthConnector;
}

export interface TestAuthConnectorRequest {
  connector: AuthConnector;
}

export interface TestAuthConnectorResponse {
  success: boolean;
  message?: string;
  user?: {
    name: string;
    roles: string[];
    traits?: Record<string, string[]>;
  };
}

// ==========================================
// 新增类型 - 可信集群管理
// ==========================================

export interface TrustedCluster {
  kind: 'trusted_cluster';
  version: 'v2';
  metadata: {
    name: string;
    description?: string;
    labels?: Record<string, string>;
  };
  spec: {
    enabled: boolean;
    token: string;
    proxy_address: string;
    role_map: RoleMapping[];
  };
  status?: {
    state: 'connected' | 'disconnected' | 'pending';
    last_connected?: string;
    last_status_check?: string;
  };
}

export interface RoleMapping {
  remote: string;
  local: string[];
}

export interface CreateTrustedClusterRequest {
  cluster: TrustedCluster;
}

export interface UpdateTrustedClusterRequest {
  cluster: TrustedCluster;
}

export interface TrustedClusterToken {
  token: string;
  expires?: string;
}

// ==========================================
// 新增类型 - 访问请求管理
// ==========================================

export interface AccessRequest {
  id: string;
  user: string;
  roles: string[];
  state: 'pending' | 'approved' | 'denied' | 'expired';
  created: string;
  expires: string;
  requestReason?: string;
  resolveBy?: string;
  resolveTime?: string;
  resolveReason?: string;
}

export interface CreateAccessRequestRequest {
  roles: string[];
  reason: string;
}

export interface ReviewAccessRequestRequest {
  request_id: string;
  approved: boolean;
  reason?: string;
}

// ==========================================
// 新增类型 - 令牌管理
// ==========================================

export interface Token {
  id: string;
  metadata: {
    name: string;
    description?: string;
    created?: string;
    labels?: Record<string, string>;
  };
  spec: {
    roles: string[];
    expires?: string;
  };
}

export interface CreateTokenRequest {
  metadata: {
    name: string;
    description?: string;
  };
  spec: {
    roles: string[];
    expires?: string;
  };
}

export interface CreateTokenResponse {
  token: string;
  metadata: {
    name: string;
  };
}
