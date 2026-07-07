# Scrapeer n8n Nodes

Scrapeer n8n Nodes connect n8n workflows to
[Scrapeer](https://www.scrapeer.com), a cloud browser automation and web
scraping platform.

Use Scrapeer with n8n to trigger saved browser automation flows, pass runtime
input variables, monitor cloud runs, and retrieve web scraping or data
extraction results inside your n8n workflows.

## What You Can Automate

- Run saved Scrapeer browser automation flows from n8n.
- Pass n8n data into Scrapeer flows with input variables.
- Wait for short cloud runs and return results to the workflow.
- Poll longer cloud runs and continue when results are ready.
- List saved flows and recent cloud runs available to your API key.

## Credentials

Create a Scrapeer API key in Scrapeer settings at
[scrapeer.com](https://www.scrapeer.com) with these scopes:

- `flows:read`
- `runs:read`
- `runs:write`
- `account:read`

The credential test calls `GET /api/v1/user/entitlements`.

Cloud run actions require an active Scrapeer subscription. The node checks `features.cloudRun.allowed` before starting a run for clearer errors, and the Scrapeer API enforces the entitlement again on `POST /api/v1/cloud/run`.

## Nodes

- **Scrapeer** — list flows, run a flow, wait for a run, get a run, and list runs.
- **Scrapeer Trigger** — polling trigger for terminal cloud runs.

Scrapeer runs are asynchronous. Use **Run Flow and Wait** for short jobs, or **Run Flow** followed by **Get Run** / **Scrapeer Trigger** for longer jobs.

Run actions support **Input Variables**, a JSON object that seeds Scrapeer variables before the Flow starts. For example:

```json
{
  "url": "https://example.com/products",
  "searchTerm": "running shoes"
}
```

Use those values inside Scrapeer with `{{url}}`, `{{searchTerm}}`, or another matching variable name. Keep inputs small and structured; do not pass large scraped datasets or files.

Run actions generate an idempotency key automatically when the field is left empty. This prevents duplicate Scrapeer Cloud Runs if n8n retries the same node execution. Provide your own idempotency key only when you need to coordinate retries across separate n8n executions.
