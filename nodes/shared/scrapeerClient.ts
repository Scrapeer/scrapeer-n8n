import { sleep } from "n8n-workflow";

export interface ScrapeerClientOptions {
  apiKey: string;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
}

export interface FlowSummary {
  ID: string;
  Title: string;
  CreatedAt: string;
  UpdatedAt: string;
  BlockCount: number;
  BlockTypes: string[];
}

export interface FlowListResponse {
  data: FlowSummary[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface TriggerRunOptions {
  projectId: string;
  maxTotalCredits?: number;
  idempotencyKey?: string;
  inputs?: Record<string, unknown>;
}

export interface FeatureEntitlement {
  allowed: boolean;
  reasonCode?: string | null;
  reason?: string | null;
  effectiveUntil?: string | null;
}

export interface UserEntitlementsResponse {
  version: number;
  generatedAt: string;
  plan?: {
    tier?: string;
    billingCycle?: string;
    status?: string;
  };
  features?: {
    cloudRun?: FeatureEntitlement;
  };
  limits?: {
    maxConcurrentCloudRuns?: number;
    maxActiveSchedules?: number;
  };
}

export interface TriggerRunResponse {
  workflow_id: string;
  run_id?: string;
  execution_id: string;
  status?: string;
  estimated_credits?: number;
}

export interface ExecutionResponse {
  id: string;
  projectId: string | null;
  projectTitle: string | null;
  projectDeleted?: boolean;
  status: string;
  mode: string;
  trigger?: string;
  totalBlocks?: number;
  createdAt: string;
  updatedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  creditsUsed?: number | null;
  error?: { code?: string; message: string } | string | null;
  data?: Record<string, unknown> | null;
  outputs?: Record<string, unknown> | null;
  variables?: Record<string, unknown> | null;
  workflowId?: string;
  temporalRunId?: string;
  blockPreviews?: unknown[];
}

export interface ExecutionListFilters {
  limit?: number;
  offset?: number;
  status?: string;
  projectId?: string;
  mode?: "cloud" | "local";
  trigger?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ExecutionListResponse {
  data?: ExecutionResponse[];
  executions?: ExecutionResponse[];
  total?: number;
  limit?: number;
  offset?: number;
}

export class ScrapeerClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly userAgent?: string;
  private readonly timeoutMs: number;

  constructor(options: ScrapeerClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ?? "https://auth.scrapeer.com"
    );
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async listFlows(limit = 100, offset = 0): Promise<FlowListResponse> {
    return this.request(
      "GET",
      `/api/v1/projects?limit=${limit}&offset=${offset}`
    );
  }

  async triggerRun(options: TriggerRunOptions): Promise<TriggerRunResponse> {
    return this.request("POST", "/api/v1/cloud/run", {
      project_id: options.projectId,
      worker_count: 1,
      ...(options.maxTotalCredits != null
        ? { max_total_credits: options.maxTotalCredits }
        : {}),
      ...(options.idempotencyKey
        ? { idempotency_key: options.idempotencyKey }
        : {}),
      ...(options.inputs && Object.keys(options.inputs).length > 0
        ? { inputs: options.inputs }
        : {}),
    });
  }

  async getEntitlements(): Promise<UserEntitlementsResponse> {
    return this.request("GET", "/api/v1/user/entitlements");
  }

  async getExecution(executionId: string): Promise<ExecutionResponse> {
    return this.request(
      "GET",
      `/api/v1/executions/${encodeURIComponent(executionId)}`
    );
  }

  async listExecutions(
    filters: ExecutionListFilters = {}
  ): Promise<ExecutionResponse[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value !== "") {
        params.set(key, String(value));
      }
    }

    const qs = params.toString();
    const response = await this.request<ExecutionListResponse>(
      "GET",
      `/api/v1/executions${qs ? `?${qs}` : ""}`
    );
    return response.data ?? response.executions ?? [];
  }

  async waitForExecution(
    executionId: string,
    timeoutMs: number,
    pollIntervalMs: number
  ): Promise<ExecutionResponse> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const execution = await this.getExecution(executionId);
      if (isTerminalExecutionStatus(execution.status)) {
        return execution;
      }

      if (Date.now() + pollIntervalMs > deadline) {
        return execution;
      }

      await delay(pollIntervalMs);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.userAgent) {
      headers["User-Agent"] = this.userAgent;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(await responseMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "https://auth.scrapeer.com";
  }
  return trimmed.replace(/\/+$/, "");
}

export function isTerminalExecutionStatus(status: string): boolean {
  return ["completed", "failed", "cancelled", "filtered"].includes(status);
}

async function responseMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return `Scrapeer API request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

function delay(ms: number): Promise<void> {
  return sleep(ms);
}
