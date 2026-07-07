import type {
  IDataObject,
  IExecuteFunctions,
  INode,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IWorkflowMetadata,
} from "n8n-workflow";
import { createHash } from "node:crypto";
import { ApplicationError, NodeOperationError } from "n8n-workflow";
import { createScrapeerClient } from "../shared/client";
import type { ScrapeerClient } from "../shared/scrapeerClient";
import {
  executionToItem,
  flowToItem,
  triggerRunToItem,
} from "../shared/transform";

export class Scrapeer implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Scrapeer",
    name: "scrapeer",
    icon: "file:scrapeer.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + \': \' + $parameter["resource"]}}',
    description:
      "Run saved Scrapeer browser automation flows in the cloud and pass structured results to n8n",
    usableAsTool: true,
    defaults: {
      name: "Scrapeer",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "scrapeerApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Flow",
            value: "flow",
          },
          {
            name: "Run",
            value: "run",
          },
        ],
        default: "flow",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["flow"],
          },
        },
        options: [
          {
            name: "List Flows",
            value: "listFlows",
            action: "List saved flows",
            description: "List saved Scrapeer flows available to this API key",
          },
          {
            name: "Run Flow",
            value: "runFlow",
            action: "Start a saved cloud run",
            description:
              "Start a saved Scrapeer cloud run and return the execution ID immediately",
          },
          {
            name: "Run Flow and Wait",
            value: "runFlowAndWait",
            action: "Start a saved cloud run and wait for the result",
            description:
              "Start a saved Scrapeer cloud run and poll until it finishes or the timeout is reached",
          },
        ],
        default: "runFlow",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["run"],
          },
        },
        options: [
          {
            name: "Get Run",
            value: "getRun",
            action: "Fetch run status and output",
            description:
              "Fetch status, output, error, and metadata for a Scrapeer execution",
          },
          {
            name: "List Runs",
            value: "listRuns",
            action: "List recent cloud runs",
            description: "List recent Scrapeer cloud executions",
          },
        ],
        default: "getRun",
      },
      {
        displayName: "Flow Name or ID",
        name: "projectId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getFlows",
        },
        required: true,
        default: "",
        description:
          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlow", "runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Execution ID",
        name: "executionId",
        type: "string",
        required: true,
        default: "",
        displayOptions: {
          show: {
            resource: ["run"],
            operation: ["getRun"],
          },
        },
      },
      {
        displayName: "Max Credits",
        name: "maxTotalCredits",
        type: "number",
        typeOptions: {
          minValue: 0,
        },
        default: 0,
        description:
          "Optional maximum credits to spend. Leave 0 to let Scrapeer use the default estimate.",
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlow", "runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Idempotency Key",
        name: "idempotencyKey",
        type: "string",
        default: "",
        description:
          "Optional override. Leave empty to let the node generate a stable key for n8n retries.",
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlow", "runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Input Variables",
        name: "inputVariables",
        type: "json",
        default: "{}",
        description:
          'JSON object of Scrapeer variables to seed before the Flow starts. Example: {"targetURL":"https://example.com","searchTerm":"shoes"}. Use these in a Flow as {{targetURL}} or {{searchTerm}}.',
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlow", "runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Timeout (Seconds)",
        name: "timeoutSeconds",
        type: "number",
        typeOptions: {
          minValue: 10,
        },
        default: 120,
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Poll Interval (Seconds)",
        name: "pollIntervalSeconds",
        type: "number",
        typeOptions: {
          minValue: 2,
        },
        default: 5,
        displayOptions: {
          show: {
            resource: ["flow"],
            operation: ["runFlowAndWait"],
          },
        },
      },
      {
        displayName: "Status",
        name: "status",
        type: "options",
        options: [
          { name: "Active", value: "active" },
          { name: "Any", value: "" },
          { name: "Cancelled", value: "cancelled" },
          { name: "Completed", value: "completed" },
          { name: "Failed", value: "failed" },
          { name: "Started", value: "started" },
          { name: "Waiting", value: "waiting" },
        ],
        default: "",
        displayOptions: {
          show: {
            resource: ["run"],
            operation: ["listRuns"],
          },
        },
      },
      {
        displayName: "Flow ID",
        name: "filterProjectId",
        type: "string",
        default: "",
        description: "Optional flow ID to filter runs",
        displayOptions: {
          show: {
            resource: ["run"],
            operation: ["listRuns"],
          },
        },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 50,
        description: "Max number of results to return",
        displayOptions: {
          show: {
            resource: ["flow", "run"],
            operation: ["listFlows", "listRuns"],
          },
        },
      },
      {
        displayName: "Offset",
        name: "offset",
        type: "number",
        typeOptions: {
          minValue: 0,
        },
        default: 0,
        displayOptions: {
          show: {
            resource: ["flow", "run"],
            operation: ["listFlows", "listRuns"],
          },
        },
      },
    ],
  };

  methods = {
    loadOptions: {
      async getFlows(
        this: ILoadOptionsFunctions
      ): Promise<INodePropertyOptions[]> {
        const client = await createScrapeerClient(this);
        const response = await client.listFlows(100, 0);

        return response.data.map((flow) => ({
          name: flow.Title,
          value: flow.ID,
          description: `${flow.BlockCount} block${
            flow.BlockCount === 1 ? "" : "s"
          }`,
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const client = await createScrapeerClient(this);
    const items = this.getInputData();
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;
    const returnData: INodeExecutionData[] = [];
    const itemCount = Math.max(items.length, 1);
    let cloudRunEntitlementChecked = false;

    for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
      try {
        if (resource === "flow" && operation === "listFlows") {
          const limit = this.getNodeParameter("limit", itemIndex) as number;
          const offset = this.getNodeParameter("offset", itemIndex) as number;
          const response = await client.listFlows(limit, offset);
          returnData.push(
            ...response.data.map((flow) => toItem(flowToItem(flow), itemIndex))
          );
          continue;
        }

        if (
          resource === "flow" &&
          (operation === "runFlow" || operation === "runFlowAndWait")
        ) {
          if (!cloudRunEntitlementChecked) {
            const denialReason = await cloudRunDenialReason(client);
            if (denialReason) {
              throw new NodeOperationError(this.getNode(), denialReason, {
                itemIndex,
              });
            }
            cloudRunEntitlementChecked = true;
          }

          const projectId = this.getNodeParameter(
            "projectId",
            itemIndex
          ) as string;
          const maxTotalCredits = optionalNumber(
            this.getNodeParameter("maxTotalCredits", itemIndex) as number
          );
          const idempotencyKey =
            optionalString(
              this.getNodeParameter("idempotencyKey", itemIndex) as string
            ) ??
            buildDefaultIdempotencyKey(this, operation, itemIndex, projectId);
          const inputVariables = parseInputVariables(
            this.getNodeParameter("inputVariables", itemIndex)
          );
          const run = await client.triggerRun({
            projectId,
            maxTotalCredits,
            idempotencyKey,
            inputs: inputVariables,
          });

          if (operation === "runFlow") {
            returnData.push(toItem(triggerRunToItem(run), itemIndex));
            continue;
          }

          const timeoutSeconds = this.getNodeParameter(
            "timeoutSeconds",
            itemIndex
          ) as number;
          const pollIntervalSeconds = this.getNodeParameter(
            "pollIntervalSeconds",
            itemIndex
          ) as number;
          const execution = await client.waitForExecution(
            run.execution_id,
            timeoutSeconds * 1000,
            pollIntervalSeconds * 1000
          );
          returnData.push(
            toItem(
              { ...triggerRunToItem(run), run: executionToItem(execution) },
              itemIndex
            )
          );
          continue;
        }

        if (resource === "run" && operation === "getRun") {
          const executionId = this.getNodeParameter(
            "executionId",
            itemIndex
          ) as string;
          const execution = await client.getExecution(executionId);
          returnData.push(toItem(executionToItem(execution), itemIndex));
          continue;
        }

        if (resource === "run" && operation === "listRuns") {
          const limit = this.getNodeParameter("limit", itemIndex) as number;
          const offset = this.getNodeParameter("offset", itemIndex) as number;
          const status = optionalString(
            this.getNodeParameter("status", itemIndex) as string
          );
          const projectId = optionalString(
            this.getNodeParameter("filterProjectId", itemIndex) as string
          );
          const executions = await client.listExecutions({
            limit,
            offset,
            status,
            projectId,
          });
          returnData.push(
            ...executions.map((execution) =>
              toItem(executionToItem(execution), itemIndex)
            )
          );
          continue;
        }

        throw new NodeOperationError(
          this.getNode(),
          `Unsupported resource operation: ${resource}.${operation}`,
          {
            itemIndex,
          }
        );
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push(toItem({ error: errorMessage(error) }, itemIndex));
          continue;
        }

        if (error instanceof NodeOperationError) {
          throw error;
        }

        throw new NodeOperationError(this.getNode(), errorMessage(error), {
          itemIndex,
        });
      }
    }

    return [returnData];
  }
}

function toItem(
  json: Record<string, unknown>,
  itemIndex: number
): INodeExecutionData {
  return {
    json: json as IDataObject,
    pairedItem: {
      item: itemIndex,
    },
  };
}

function optionalNumber(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const INPUT_VARIABLES_MAX_BYTES = 64 * 1024;
const inputVariableNameRE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseInputVariables(
  raw: unknown
): Record<string, unknown> | undefined {
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "{}") {
      return undefined;
    }

    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch (error) {
      throw new ApplicationError(
        `Input Variables must be valid JSON. ${errorMessage(error)}`
      );
    }
  }

  if (!isPlainObject(parsed)) {
    throw new ApplicationError("Input Variables must be a JSON object.");
  }

  const inputs = parsed as Record<string, unknown>;
  if (Object.keys(inputs).length === 0) {
    return undefined;
  }

  for (const name of Object.keys(inputs)) {
    if (name.startsWith("__")) {
      throw new ApplicationError(
        `Input variable "${name}" uses reserved prefix __.`
      );
    }
    if (!inputVariableNameRE.test(name)) {
      throw new ApplicationError(
        `Input variable "${name}" must match ${inputVariableNameRE.source}.`
      );
    }
  }

  const encoded = JSON.stringify(inputs);
  if (Buffer.byteLength(encoded, "utf8") > INPUT_VARIABLES_MAX_BYTES) {
    throw new ApplicationError(
      `Input Variables must be ${INPUT_VARIABLES_MAX_BYTES} bytes or less.`
    );
  }

  return inputs;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function cloudRunDenialReason(
  client: ScrapeerClient
): Promise<string | null> {
  const entitlements = await client.getEntitlements();
  const cloudRun = entitlements.features?.cloudRun;

  if (cloudRun?.allowed === false) {
    return (
      cloudRun.reason ?? "Cloud runs require an active Scrapeer subscription."
    );
  }

  return null;
}

interface IdempotencyContext {
  getExecutionId(): string;
  getWorkflow(): IWorkflowMetadata;
  getNode(): INode;
}

export function buildDefaultIdempotencyKey(
  context: IdempotencyContext,
  operation: string,
  itemIndex: number,
  projectId: string
): string {
  const workflow = context.getWorkflow();
  const node = context.getNode();
  const raw = [
    "n8n",
    workflow.id ?? workflow.name ?? "workflow",
    context.getExecutionId(),
    node.id ?? node.name,
    operation,
    String(itemIndex),
    projectId,
  ].join(":");

  return `n8n:${createHash("sha256").update(raw).digest("hex")}`;
}
