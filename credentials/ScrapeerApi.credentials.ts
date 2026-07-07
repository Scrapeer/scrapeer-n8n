import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class ScrapeerApi implements ICredentialType {
  name = "scrapeerApi";
  displayName = "Scrapeer API";
  documentationUrl = "https://docs.scrapeer.com";
  icon = "file:scrapeer.svg" as const;

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: true,
      description: "Scrapeer API key for listing saved flows and starting Cloud Runs. Required scopes: flows:read, runs:read, runs:write, and account:read.",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://auth.scrapeer.com",
      url: "/api/v1/user/entitlements",
      method: "GET",
    },
  };
}
