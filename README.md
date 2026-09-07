# BigQuery Explorer

A local web app for browsing a BigQuery table: connect a service account,
pick a table, see its schema/size/row count, load data, filter it
interactively, and export the filtered result as CSV or Excel.

- **Backend**: FastAPI + `google-cloud-bigquery` (Python)
- **Frontend**: React + Vite + AG Grid (TypeScript)

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Cloud service account JSON key file with BigQuery read access
  (`roles/bigquery.dataViewer` on the tables + `roles/bigquery.jobUser` on
  the project so it can run queries)

## Quick start (Windows)

```powershell
.\start.ps1
```

This sets up the Python venv and npm dependencies on first run, then opens
the backend (`:8000`) and frontend (`:5173`) each in their own terminal
window. Open http://localhost:5173.

## Manual setup

**Backend**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
.\venv\Scripts\python -m uvicorn app.main:app --port 8000
```

**Frontend** (separate terminal)

```powershell
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## Using it

1. **Connect a service account** — paste the full path to your service
   account JSON key file and click Connect. The path is only read by the
   local backend process; the key file itself is never uploaded anywhere.
2. **Pick a table** — either type `project.dataset.table` directly, or
   save it with a label so it shows up as a quick-select next time
   (saved tables are stored in `config/saved_tables.json`).
3. **Review the table info card** — row count, size, description,
   created/modified dates, and full schema.
4. **Load data** — set a row limit (capped by `MAX_ROW_LIMIT`, default
   200,000) and optionally an advanced SQL `WHERE` clause / `ORDER BY` to
   scope what gets pulled from BigQuery.
5. **Filter interactively** — every column header has a filter icon
   (text/number/date depending on the column type) and is sortable. This
   filtering happens client-side on the loaded rows, so it's instant.
6. **Export** — "Export CSV" / "Export Excel" export exactly what's
   currently visible in the grid (respecting your filters and sort).

## Configuration

Copy `backend/.env.example` to `backend/.env` to change defaults:

| Variable | Default | Purpose |
|---|---|---|
| `SERVICE_ACCOUNT_PATH` | _(empty)_ | Pre-fill the service account on startup instead of entering it in the UI |
| `MAX_ROW_LIMIT` | `200000` | Hard cap on rows a single "Load data" can pull |
| `DEFAULT_ROW_LIMIT` | `5000` | Row limit pre-filled in the UI |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowlist |

## Notes

- This is built for local, single-user use — the service account and
  saved-table list are process-wide state, not per-user/session.
- The advanced `WHERE` clause field sends raw SQL to BigQuery. That's
  intentional here: it only runs against tables your own service account
  can already query, on your own local instance — equivalent to running
  the same query in the BigQuery console.
- Data grid filtering/sorting/export happens on the rows loaded by "Load
  data", not the whole table — raise the row limit or narrow with a
  `WHERE` clause for large tables rather than loading everything.
