# Scrapeer n8n Nodes

Trigger and monitor saved Scrapeer cloud flows from n8n.

## Credentials

Create a Scrapeer API key in Scrapeer settings with these scopes:

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
