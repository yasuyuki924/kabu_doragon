# Repository Agent Notes

## Pages Deployment And Data Updates

- Treat UI-only changes and data acquisition as separate work.
- For UI-only changes such as Pick button styling or layout updates, do not run J-Quants refresh. Push the UI commit to the Pages source branch and run a Pages deploy without `refresh_data`.
- If a date is missing from the public mobile site but exists in local generated data, first confirm whether the public Pages artifact is stale. Do not assume J-Quants acquisition is needed.
- Use J-Quants refresh only when the requested market data has not been acquired/generated yet, or when the user explicitly asks to fetch fresh market data.
- For existing generated data that simply is not public yet, prefer a cached/public-data rebuild or artifact publish path over a fresh J-Quants fetch.
- Keep these concerns separate in status updates: UI deploy, public data publish, and J-Quants data acquisition.
