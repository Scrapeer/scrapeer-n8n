import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IPollFunctions,
} from "n8n-workflow";
import { createScrapeerClient } from "../shared/client";
import { isTerminalExecutionStatus } from "../shared/scrapeerClient";
import { executionToItem } from "../shared/transform";

interface TriggerStaticData {
  seenExecutionIds?: string[];
  initialized?: boolean;
}

export class ScrapeerTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Scrapeer Trigger",
    name: "scrapeerTrigger",
    icon: "file:scrapeer.svg",
    group: ["trigger"],
    version: 1,
    description: "Poll Scrapeer for finished cloud runs and start this workflow with the run result",
    usableAsTool: true,
    defaults: {
      name: "Scrapeer Trigger",
    },
    inputs: [],
    outputs: ["main"],
    credentials: [
      {
        name: "scrapeerApi",
        required: true,
      },
    ],
    polling: true,
    properties: [
      {
        displayName: "Flow ID",
        name: "projectId",
        type: "string",
        default: "",
        description: "Optional Scrapeer flow ID to watch. Leave empty to watch all flows.",
      },
      {
        displayName: "Status",
        name: "status",
        type: "options",
        options: [
          { name: "Any Terminal Status", value: "", description: "Emit completed, failed, cancelled, or filtered runs" },
          { name: "Cancelled", value: "cancelled", description: "Emit cancelled runs only" },
          { name: "Completed", value: "completed", description: "Emit successful runs only" },
          { name: "Failed", value: "failed", description: "Emit failed runs only" },
          { name: "Filtered", value: "filtered", description: "Emit runs stopped by Scrapeer filters only" },
        ],
        default: "",
      },
      {
        displayName: "Emit Existing Runs on First Poll",
        name: "emitOnFirstPoll",
        type: "boolean",
        default: false,
        description: "Whether to emit already-finished runs the first time the trigger polls",
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
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const client = await createScrapeerClient(this);
    const staticData = this.getWorkflowStaticData("node") as TriggerStaticData;
    const projectId = optionalString(this.getNodeParameter("projectId") as string);
    const status = optionalString(this.getNodeParameter("status") as string);
    const limit = this.getNodeParameter("limit") as number;
    const emitOnFirstPoll = this.getNodeParameter("emitOnFirstPoll") as boolean;

    const executions = await client.listExecutions({
      limit,
      projectId,
      status,
      mode: "cloud",
    });

    const terminalExecutions = executions.filter((execution) =>
      status ? execution.status === status : isTerminalExecutionStatus(execution.status),
    );

    const seen = new Set(staticData.seenExecutionIds ?? []);
    const unseen = terminalExecutions.filter((execution) => !seen.has(execution.id));

    staticData.seenExecutionIds = mergeSeenIds(terminalExecutions.map((execution) => execution.id), staticData.seenExecutionIds);

    if (!staticData.initialized) {
      staticData.initialized = true;
      if (!emitOnFirstPoll) {
        return null;
      }
    }

    if (unseen.length === 0) {
      return null;
    }

    return [
      unseen
        .slice()
        .reverse()
        .map((execution) => ({
          json: executionToItem(execution) as IDataObject,
        })),
    ];
  }
}

function mergeSeenIds(newIds: string[], previousIds: string[] = []): string[] {
  return [...new Set([...newIds, ...previousIds])].slice(0, 500);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
