import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type {
  ApiError,
  LoginRequest,
  LoginResponse,
  UserContext,
  ChangePasswordRequest,
  ChangePasswordResponse,
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  PingResponse,
  CreateResetPasswordTokenRequest,
  ResetPasswordToken,
  ChangePasswordWithTokenRequest,
  MFADevice,
  MFAChallengeRequest,
  MFAChallengeResponse,
  CreateU2FSessionRequest,
  AddTOTPDeviceRequest,
  AddTOTPDeviceResponse,
  VerifyTOTPRequest,
  AddU2FDeviceRequest,
  AddU2FDeviceResponse,
  RegisterU2FDeviceRequest,
  AuthConnector,
  CreateAuthConnectorRequest,
  UpdateAuthConnectorRequest,
  TestAuthConnectorRequest,
  TestAuthConnectorResponse,
  TrustedCluster,
  CreateTrustedClusterRequest,
  UpdateTrustedClusterRequest,
  TrustedClusterToken,
  AccessRequest,
  CreateAccessRequestRequest,
  ReviewAccessRequestRequest,
  Token,
  CreateTokenRequest,
  CreateTokenResponse,
} from '../types/api';

const API_BASE_URL = '/v1';

// 从 sessionStorage 恢复 bearer token（页面刷新后保留，关闭标签页后清除）
let bearerToken: string | null = sessionStorage.getItem('bearer_token');

// 设置 bearer token（登录时调用）
export const setBearerToken = (token: string | null) => {
  bearerToken = token;
  if (token) {
    sessionStorage.setItem('bearer_token', token);
  } else {
    sessionStorage.removeItem('bearer_token');
  }
};

// 获取 bearer token
export const getBearerToken = () => bearerToken;

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 允许携带 cookie
  withCredentials: true,
});

// 请求拦截器：自动添加认证头
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const csrfToken = localStorage.getItem('csrf_token');

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    if (bearerToken) {
      config.headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Session 过期，清除本地存储并跳转登录
      localStorage.removeItem('csrf_token');
      setBearerToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关 API
export const authApi = {
  // 获取认证设置（用于 SSO 和 2FA 配置）
  async getAuthSettings(): Promise<PingResponse> {
    const response = await fetch('/v1/webapi/ping', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      // 如果 ping 失败，返回默认配置（仅本地认证）
      return {
        auth: {
          type: 'local',
          second_factor: 'off',
          local: { name: 'local' },
          oidc: [],
          saml: [],
          github: [],
          u2f: null,
        },
        proxy: { publicAddr: '' },
        server_version: '',
        min_client_version: '',
      };
    }

    return await response.json();
  },

  // 获取 CSRF Token
  async getCsrfToken(): Promise<string> {
    // 尝试从 localStorage 获取已保存的 token
    const savedToken = localStorage.getItem('csrf_token');
    if (savedToken) {
      return savedToken;
    }

    // 通过后端端点获取 CSRF token
    try {
      const response = await fetch('/__csrf-token', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.csrf) {
          localStorage.setItem('csrf_token', data.csrf);
          return data.csrf;
        }
      }
    } catch {
      // 如果端点不可用，继续尝试其他方法
    }

    // Bootstrap CSRF cookie: /web/ triggers backend Set-Cookie which Vite proxy saves
    try {
      await fetch('/web/', {
        credentials: 'include',
        cache: 'no-store',
      });
    } catch {
      // Cookie presence is what matters, not the response
    }

    // Retry /__csrf-token after bootstrapping
    try {
      const retryResponse = await fetch('/__csrf-token', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (retryResponse.ok) {
        const data = await retryResponse.json();
        if (data.csrf) {
          localStorage.setItem('csrf_token', data.csrf);
          return data.csrf;
        }
      }
    } catch {
      // Fall through to HTML meta tag extraction
    }

    // Production: extract CSRF from backend-rendered HTML meta tag
    const response = await fetch('/web', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to get CSRF token');
    }

    // 尝试从 HTML meta 标签获取（后端渲染模式）
    const html = await response.text();
    const match = html.match(/<meta\s+name="grv_csrf_token"\s+content="([^"]+)"/i);
    if (match && match[1] !== '{{ .XCSRF }}') {
      return match[1];
    }

    throw new Error('Failed to get CSRF token');
  },

  // 登录
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // 1. 先获取 CSRF Token
    const csrfToken = await this.getCsrfToken();
    localStorage.setItem('csrf_token', csrfToken);

    // 2. 发送登录请求
    const response = await fetch('/v1/webapi/sessions/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.message || 'Login failed');
    }

    const data: LoginResponse = await response.json();

    // 保存 bearer token 到内存（不存储到 localStorage，防止 XSS 攻击）
    setBearerToken(data.token);

    return data;
  },

  // 登出
  async logout(): Promise<void> {
    try {
      await apiClient.delete('/webapi/sessions');
    } finally {
      localStorage.removeItem('csrf_token');
      setBearerToken(null);
      // cookie 由后端自动清除
    }
  },

  // 获取用户上下文
  async getUserContext(clusterName: string): Promise<UserContext> {
    const response = await apiClient.get<UserContext>(`/webapi/sites/${clusterName}/context`);
    return response.data;
  },

  // 检查登录状态
  async checkAuth(): Promise<boolean> {
    try {
      // 通过 ping 接口检查 session 是否有效
      const response = await fetch('/v1/webapi/ping', {
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // MFA 相关 API

  // 获取 MFA 挑战（用于 U2F 登录）
  async getMFAChallenge(request: MFAChallengeRequest): Promise<MFAChallengeResponse> {
    const response = await apiClient.post<MFAChallengeResponse>('/webapi/u2f/signrequest', request);
    return response.data;
  },

  // 使用 U2F 签名创建会话
  async createSessionWithU2F(request: CreateU2FSessionRequest): Promise<LoginResponse> {
    const csrfToken = await this.getCsrfToken();
    localStorage.setItem('csrf_token', csrfToken);

    const response = await fetch('/v1/webapi/u2f/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.message || 'U2F authentication failed');
    }

    const data: LoginResponse = await response.json();
    setBearerToken(data.token);
    return data;
  },

  // 获取 MFA 设备列表
  async getMFADevices(): Promise<MFADevice[]> {
    const response = await apiClient.get<MFADevice[]>('/webapi/mfa/devices');
    return response.data;
  },

  // 添加 TOTP 设备
  async addTOTPDevice(request: AddTOTPDeviceRequest): Promise<AddTOTPDeviceResponse> {
    const response = await apiClient.post<AddTOTPDeviceResponse>('/webapi/mfa/totp', request);
    return response.data;
  },

  // 验证 TOTP 码
  async verifyTOTP(request: VerifyTOTPRequest): Promise<void> {
    await apiClient.post('/webapi/mfa/totp/verify', request);
  },

  // 添加 U2F 设备（获取挑战）
  async addU2FDevice(request: AddU2FDeviceRequest): Promise<AddU2FDeviceResponse> {
    const response = await apiClient.post<AddU2FDeviceResponse>('/webapi/u2f/signuptokens', request);
    return response.data;
  },

  // 注册 U2F 设备
  async registerU2FDevice(request: RegisterU2FDeviceRequest): Promise<void> {
    await apiClient.post('/webapi/mfa/u2f', request);
  },

  // 删除 MFA 设备
  async removeMFADevice(deviceId: string): Promise<void> {
    await apiClient.delete(`/webapi/mfa/devices/${deviceId}`);
  },
};

// 集群相关 API
export const clustersApi = {
  // 获取集群列表
  async getClusters() {
    const response = await apiClient.get('/webapi/sites');
    // 后端返回的是数组格式，包装成 { items: [] } 格式
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },

  // 获取命名空间列表
  async getNamespaces(clusterName: string) {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/namespaces`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },
};

// 节点相关 API
export const nodesApi = {
  // 获取节点列表
  async getNodes(clusterName: string, namespace: string = 'default') {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/namespaces/${namespace}/nodes`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },
};

// 用户相关 API
export const usersApi = {
  // 获取用户列表
  async getUsers() {
    const response = await apiClient.get('/webapi/users');
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },

  // 创建用户
  async createUser(user: { name: string; roles: string[] }) {
    const response = await apiClient.post('/webapi/users', user);
    return response.data;
  },

  // 更新用户
  async updateUser(user: { name: string; roles: string[] }) {
    const response = await apiClient.put('/webapi/users', user);
    return response.data;
  },

  // 删除用户
  async deleteUser(username: string) {
    const response = await apiClient.delete(`/webapi/users/${username}`);
    return response.data;
  },

  // 修改密码
  async changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    const response = await apiClient.put<ChangePasswordResponse>('/webapi/users/password', request);
    return response.data;
  },

  // 创建重置/邀请令牌
  async createResetPasswordToken(request: CreateResetPasswordTokenRequest): Promise<ResetPasswordToken> {
    const response = await apiClient.post<ResetPasswordToken>('/webapi/users/password/token', request);
    return response.data;
  },

  // 获取重置令牌详情
  async getResetPasswordToken(token: string): Promise<ResetPasswordToken> {
    const response = await apiClient.get<ResetPasswordToken>(`/webapi/users/password/token/${token}`);
    return response.data;
  },

  // 使用令牌设置密码
  async changePasswordWithToken(request: ChangePasswordWithTokenRequest): Promise<LoginResponse> {
    const response = await apiClient.put<LoginResponse>('/webapi/users/password/token', request);
    return response.data;
  },
};

// 角色相关 API
export const rolesApi = {
  // 获取角色列表
  async getRoles() {
    const response = await apiClient.get('/webapi/roles');
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },

  // 创建/更新角色
  async upsertRole(role: { name: string; content: string }) {
    const response = await apiClient.post('/webapi/roles', role);
    return response.data;
  },

  // 删除角色
  async deleteRole(name: string) {
    const response = await apiClient.delete(`/webapi/roles/${name}`);
    return response.data;
  },
};

// 会话相关 API
export const sessionsApi = {
  // 获取活跃会话列表
  async getSessions(clusterName: string, namespace: string = 'default') {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/namespaces/${namespace}/sessions`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },

  // 获取会话详情
  async getSession(clusterName: string, namespace: string, sessionId: string) {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/namespaces/${namespace}/sessions/${sessionId}`);
    return response.data;
  },

  // 创建新会话（连接节点）
  async createSession(
    clusterName: string,
    namespace: string,
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> {
    const response = await apiClient.post<CreateSessionResponse>(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/sessions`,
      request
    );
    return response.data;
  },

  // 加入活跃会话
  async joinSession(
    clusterName: string,
    namespace: string,
    sessionId: string
  ): Promise<Session> {
    const response = await apiClient.post<Session>(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/sessions/${sessionId}/join`
    );
    return response.data;
  },

  // 续期会话
  async renewSession(
    clusterName: string,
    namespace: string,
    sessionId: string
  ): Promise<void> {
    await apiClient.post(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/sessions/${sessionId}/renew`
    );
  },
};

// 审计相关 API
export const auditApi = {
  // 搜索审计事件
  async searchEvents(
    clusterName: string,
    params: {
      from?: string;
      to?: string;
      limit?: number;
      order?: 'asc' | 'desc';
      include?: string;
      startKey?: string;
    }
  ) {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.order) queryParams.set('order', params.order);
    if (params.include) queryParams.set('include', params.include);
    if (params.startKey) queryParams.set('startKey', params.startKey);

    const response = await apiClient.get(`/webapi/sites/${clusterName}/events/search?${queryParams.toString()}`);
    return response.data;
  },

  // 获取会话事件（录屏用）
  async getSessionEvents(clusterName: string, namespace: string, sessionId: string, after?: number) {
    const queryParams = new URLSearchParams();
    if (after !== undefined) queryParams.set('after', after.toString());

    const response = await apiClient.get(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/sessions/${sessionId}/events?${queryParams.toString()}`
    );
    return response.data;
  },

  // 获取会话录屏字节流
  async getSessionChunk(
    clusterName: string,
    namespace: string,
    sessionId: string,
    offset: number,
    bytes: number
  ): Promise<ArrayBuffer> {
    const queryParams = new URLSearchParams();
    queryParams.set('offset', offset.toString());
    queryParams.set('bytes', bytes.toString());

    const response = await apiClient.get(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/sessions/${sessionId}/stream?${queryParams.toString()}`,
      { responseType: 'arraybuffer' }
    );
    return response.data as ArrayBuffer;
  },
};

// 文件传输 API
export const scpApi = {
  // 下载文件
  async downloadFile(
    clusterName: string,
    namespace: string,
    serverId: string,
    login: string,
    remotePath: string,
    filename?: string
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.set('location', remotePath);
    if (filename) queryParams.set('filename', filename);

    const response = await apiClient.get(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/nodes/${serverId}/${login}/scp?${queryParams.toString()}`,
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },

  // 上传文件
  // 后端 scp.CreateHTTPUpload 直接使用 httpReq.Body 作为文件内容，
  // Content-Length 作为文件大小，不解析 multipart form data。
  // 因此必须发送原始文件内容，不能用 FormData 包装。
  async uploadFile(
    clusterName: string,
    namespace: string,
    serverId: string,
    login: string,
    remotePath: string,
    file: File
  ): Promise<unknown> {
    const queryParams = new URLSearchParams();
    queryParams.set('location', remotePath);
    queryParams.set('filename', file.name);

    const response = await apiClient.post(
      `/webapi/sites/${clusterName}/namespaces/${namespace}/nodes/${serverId}/${login}/scp?${queryParams.toString()}`,
      file,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    );
    return response.data;
  },
};

// 应用访问 API
export const appsApi = {
  // 获取应用列表
  async getApps(clusterName: string) {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/apps`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },

  // 创建应用会话
  async createAppSession(appName: string, clusterName: string) {
    const response = await apiClient.post('/webapi/sessions/app', {
      app_name: appName,
      cluster_name: clusterName,
    });
    return response.data;
  },
};

// 数据库访问 API
export const databasesApi = {
  // 获取数据库列表
  async getDatabases(clusterName: string) {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/databases`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },
};

// Kubernetes 访问 API
export const kubernetesApi = {
  // 获取 K8s 集群列表
  async getClusters(clusterName: string) {
    const response = await apiClient.get(`/webapi/sites/${clusterName}/kubernetes`);
    const data = response.data;
    return Array.isArray(data) ? { items: data } : data;
  },
};

// 认证连接器 API
export const authConnectorsApi = {
  // 获取所有认证连接器
  async getConnectors(): Promise<AuthConnector[]> {
    const response = await apiClient.get<AuthConnector[]>('/webapi/auth/connectors');
    return response.data;
  },

  // 获取特定类型的连接器
  async getConnectorsByType(type: 'oidc' | 'saml' | 'github'): Promise<AuthConnector[]> {
    const response = await apiClient.get<AuthConnector[]>(`/webapi/auth/connectors/${type}`);
    return response.data;
  },

  // 获取单个连接器
  async getConnector(type: 'oidc' | 'saml' | 'github', name: string): Promise<AuthConnector> {
    const response = await apiClient.get<AuthConnector>(`/webapi/auth/connectors/${type}/${name}`);
    return response.data;
  },

  // 创建连接器
  async createConnector(request: CreateAuthConnectorRequest): Promise<AuthConnector> {
    const response = await apiClient.post<AuthConnector>('/webapi/auth/connectors', request);
    return response.data;
  },

  // 更新连接器
  async updateConnector(type: 'oidc' | 'saml' | 'github', name: string, request: UpdateAuthConnectorRequest): Promise<AuthConnector> {
    const response = await apiClient.put<AuthConnector>(`/webapi/auth/connectors/${type}/${name}`, request);
    return response.data;
  },

  // 删除连接器
  async deleteConnector(type: 'oidc' | 'saml' | 'github', name: string): Promise<void> {
    await apiClient.delete(`/webapi/auth/connectors/${type}/${name}`);
  },

  // 测试连接器配置
  async testConnector(request: TestAuthConnectorRequest): Promise<TestAuthConnectorResponse> {
    const response = await apiClient.post<TestAuthConnectorResponse>('/webapi/auth/connectors/test', request);
    return response.data;
  },
};

// 可信集群 API
export const trustedClustersApi = {
  // 获取可信集群列表
  async getTrustedClusters(): Promise<TrustedCluster[]> {
    const response = await apiClient.get<TrustedCluster[]>('/webapi/trustedclusters');
    return response.data;
  },

  // 获取单个可信集群
  async getTrustedCluster(name: string): Promise<TrustedCluster> {
    const response = await apiClient.get<TrustedCluster>(`/webapi/trustedclusters/${name}`);
    return response.data;
  },

  // 创建可信集群
  async createTrustedCluster(request: CreateTrustedClusterRequest): Promise<TrustedCluster> {
    const response = await apiClient.post<TrustedCluster>('/webapi/trustedclusters', request);
    return response.data;
  },

  // 更新可信集群
  async updateTrustedCluster(name: string, request: UpdateTrustedClusterRequest): Promise<TrustedCluster> {
    const response = await apiClient.put<TrustedCluster>(`/webapi/trustedclusters/${name}`, request);
    return response.data;
  },

  // 删除可信集群
  async deleteTrustedCluster(name: string): Promise<void> {
    await apiClient.delete(`/webapi/trustedclusters/${name}`);
  },

  // 生成加入令牌
  async generateJoinToken(): Promise<TrustedClusterToken> {
    const response = await apiClient.post<TrustedClusterToken>('/webapi/trustedclusters/tokens');
    return response.data;
  },
};

// 访问请求 API
export const accessRequestsApi = {
  // 获取访问请求列表
  async getAccessRequests(): Promise<AccessRequest[]> {
    const response = await apiClient.get<AccessRequest[]>('/webapi/accessrequests');
    return response.data;
  },

  // 获取待处理的访问请求（用于审批）
  async getPendingAccessRequests(): Promise<AccessRequest[]> {
    const response = await apiClient.get<AccessRequest[]>('/webapi/accessrequests/pending');
    return response.data;
  },

  // 创建访问请求
  async createAccessRequest(request: CreateAccessRequestRequest): Promise<AccessRequest> {
    const response = await apiClient.post<AccessRequest>('/webapi/accessrequests', request);
    return response.data;
  },

  // 审批访问请求
  async reviewAccessRequest(request: ReviewAccessRequestRequest): Promise<AccessRequest> {
    const response = await apiClient.post<AccessRequest>('/webapi/accessrequests/review', request);
    return response.data;
  },

  // 获取我的访问请求
  async getMyAccessRequests(): Promise<AccessRequest[]> {
    const response = await apiClient.get<AccessRequest[]>('/webapi/accessrequests/my');
    return response.data;
  },
};

// 令牌管理 API
export const tokensApi = {
  // 获取令牌列表
  async getTokens(): Promise<Token[]> {
    const response = await apiClient.get<Token[]>('/v1/tokens');
    return response.data;
  },

  // 创建令牌
  async createToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    const response = await apiClient.post<CreateTokenResponse>('/v1/tokens', request);
    return response.data;
  },

  // 删除令牌
  async deleteToken(tokenId: string): Promise<void> {
    await apiClient.delete(`/v1/tokens/${tokenId}`);
  },

  // 获取令牌详情
  async getToken(tokenId: string): Promise<Token> {
    const response = await apiClient.get<Token>(`/v1/tokens/${tokenId}`);
    return response.data;
  },
};

// 系统配置 API
export const systemConfigApi = {
  // 获取系统配置
  async getConfig(): Promise<{
    auth: {
      type: string;
      secondFactor: string;
      sessionTimeout: number;
      idleTimeout: number;
    };
    session: {
      maxConcurrent: number;
      recordingEnabled: boolean;
      joinAllowed: boolean;
    };
    network: {
      publicAddr: string;
      proxyListenerMode: string;
      keepAliveInterval: number;
    };
    audit: {
      enabled: boolean;
      retentionDays: number;
      events: string[];
    };
  }> {
    const response = await apiClient.get('/webapi/config');
    return response.data;
  },

  // 更新系统配置
  async updateConfig(config: {
    auth?: {
      type?: string;
      secondFactor?: string;
      sessionTimeout?: number;
      idleTimeout?: number;
    };
    session?: {
      maxConcurrent?: number;
      recordingEnabled?: boolean;
      joinAllowed?: boolean;
    };
    network?: {
      publicAddr?: string;
      proxyListenerMode?: string;
      keepAliveInterval?: number;
    };
    audit?: {
      enabled?: boolean;
      retentionDays?: number;
      events?: string[];
    };
  }): Promise<void> {
    await apiClient.put('/webapi/config', config);
  },
};

export default apiClient;
