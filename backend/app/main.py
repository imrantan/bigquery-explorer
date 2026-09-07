import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import bigquery_client, config
from .models import (
    SavedTable,
    ServiceAccountRequest,
    StatusResponse,
    TableDataRequest,
    TableInfoRequest,
)

app = FastAPI(title="BigQuery Explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _status() -> StatusResponse:
    state = bigquery_client.state
    return StatusResponse(
        configured=state.client is not None,
        service_account_path=state.service_account_path,
        service_account_email=state.service_account_email,
        project_id=state.client.project if state.client else None,
        error=state.error,
    )


@app.get("/api/status", response_model=StatusResponse)
def get_status():
    return _status()


@app.post("/api/service-account", response_model=StatusResponse)
def set_service_account(req: ServiceAccountRequest):
    try:
        bigquery_client.state.set_service_account(req.path)
    except Exception as exc:  # noqa: BLE001
        bigquery_client.state.error = str(exc)
        bigquery_client.state.client = None
        return _status()
    return _status()


def _read_saved_tables() -> list[dict]:
    if not config.SAVED_TABLES_PATH.exists():
        return []
    with open(config.SAVED_TABLES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_saved_tables(tables: list[dict]) -> None:
    config.SAVED_TABLES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(config.SAVED_TABLES_PATH, "w", encoding="utf-8") as f:
        json.dump(tables, f, indent=2)


@app.get("/api/saved-tables", response_model=list[SavedTable])
def list_saved_tables():
    return _read_saved_tables()


@app.post("/api/saved-tables", response_model=list[SavedTable])
def add_saved_table(table: SavedTable):
    tables = _read_saved_tables()
    if any(t["table_id"] == table.table_id for t in tables):
        raise HTTPException(400, "Table already saved")
    tables.append(table.model_dump())
    _write_saved_tables(tables)
    return tables


@app.delete("/api/saved-tables/{table_id:path}", response_model=list[SavedTable])
def remove_saved_table(table_id: str):
    tables = [t for t in _read_saved_tables() if t["table_id"] != table_id]
    _write_saved_tables(tables)
    return tables


@app.post("/api/table-info")
def table_info(req: TableInfoRequest):
    try:
        return bigquery_client.fetch_table_info(req.table_id)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Could not read table: {exc}") from exc


@app.post("/api/table-data")
def table_data(req: TableDataRequest):
    limit = min(max(1, req.row_limit), config.MAX_ROW_LIMIT)
    try:
        return bigquery_client.fetch_table_data(
            req.table_id, limit, req.where_clause, req.order_by, req.order_dir
        )
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Query failed: {exc}") from exc


@app.get("/api/config")
def get_config():
    return {
        "max_row_limit": config.MAX_ROW_LIMIT,
        "default_row_limit": config.DEFAULT_ROW_LIMIT,
    }
