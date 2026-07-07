import type { ExecutionResponse, FlowSummary, TriggerRunResponse } from "./scrapeerClient";

export function flowToItem(flow: FlowSummary): Record<string, unknown> {
  return {
    id: flow.ID,
    title: flow.Title,
    createdAt: flow.CreatedAt,
    updatedAt: flow.UpdatedAt,
    blockCount: flow.BlockCount,
    blockTypes: flow.BlockTypes,
  };
}

export function triggerRunToItem(run: TriggerRunResponse): Record<string, unknown> {
  return {
    workflow_id: run.workflow_id,
    run_id: run.run_id ?? run.execution_id,
    execution_id: run.execution_id,
    status: run.status ?? "started",
    estimated_credits: run.estimated_credits ?? null,
  };
}

export function executionToItem(execution: ExecutionResponse): Record<string, unknown> {
  return {
    id: execution.id,
    execution_id: execution.id,
    project_id: execution.projectId,
    project_title: execution.projectTitle,
    status: execution.status,
    mode: execution.mode,
    trigger: execution.trigger ?? null,
    total_blocks: execution.totalBlocks ?? null,
    created_at: execution.createdAt,
    updated_at: execution.updatedAt ?? null,
    finished_at: execution.finishedAt ?? null,
    duration_ms: execution.durationMs ?? null,
    credits_used: execution.creditsUsed ?? null,
    error: normalizeError(execution.error),
    data: execution.data ?? null,
    outputs: execution.outputs ?? execution.variables ?? null,
    workflow_id: execution.workflowId ?? null,
    temporal_run_id: execution.temporalRunId ?? null,
  };
}

function normalizeError(error: ExecutionResponse["error"]): string | Record<string, unknown> | null {
  if (error == null) {
    return null;
  }
  if (typeof error === "string") {
    return error;
  }
  return error;
}
