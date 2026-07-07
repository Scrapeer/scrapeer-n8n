import type { IExecuteFunctions, ILoadOptionsFunctions, IPollFunctions } from "n8n-workflow";
import { ScrapeerClient } from "./scrapeerClient";

const USER_AGENT = "Scrapeer-n8n/0.1.0";
const DEFAULT_SCRAPEER_BASE_URL = "https://auth.scrapeer.com";

type CredentialContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

interface ScrapeerCredentials {
  apiKey?: string;
}

export async function createScrapeerClient(context: CredentialContext): Promise<ScrapeerClient> {
  const credentials = (await context.getCredentials("scrapeerApi")) as ScrapeerCredentials;
  const apiKey = String(credentials.apiKey ?? "").trim();

  if (!apiKey) {
    throw new Error("Scrapeer API key is missing.");
  }

  return new ScrapeerClient({
    apiKey,
    baseUrl: DEFAULT_SCRAPEER_BASE_URL,
    userAgent: USER_AGENT,
  });
}
