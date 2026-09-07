import base64
import datetime
import decimal
from typing import Any, Optional

from google.cloud import bigquery
from google.cloud.bigquery import SchemaField
from google.oauth2 import service_account

from . import config
from .models import ColumnSchema


class BigQueryState:
    """Holds the single active BigQuery client for this local, single-user app."""

    def __init__(self) -> None:
        self.client: Optional[bigquery.Client] = None
        self.service_account_path: Optional[str] = None
        self.service_account_email: Optional[str] = None
        self.error: Optional[str] = None

        if config.SERVICE_ACCOUNT_PATH:
            try:
                self.set_service_account(config.SERVICE_ACCOUNT_PATH)
            except Exception as exc:  # noqa: BLE001 - surfaced via /api/status instead
                self.error = str(exc)

    def set_service_account(self, path: str) -> None:
        credentials = service_account.Credentials.from_service_account_file(
            path,
            scopes=["https://www.googleapis.com/auth/bigquery.readonly"],
        )
        client = bigquery.Client(credentials=credentials, project=credentials.project_id)
        # Cheap call that both confirms the key works and gets us the SA email.
        email = credentials.service_account_email

        self.client = client
        self.service_account_path = path
        self.service_account_email = email
        self.error = None

    def require_client(self) -> bigquery.Client:
        if self.client is None:
            raise RuntimeError(
                "No service account configured. Set one from the app first."
            )
        return self.client


state = BigQueryState()


def human_size(num_bytes: Optional[int]) -> Optional[str]:
    if num_bytes is None:
        return None
    size = float(num_bytes)
    for unit in ["B", "KB", "MB", "GB", "TB", "PB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024.0
    return f"{size:.1f} EB"


def _flatten_schema(fields: list[SchemaField], prefix: str = "") -> list[ColumnSchema]:
    columns: list[ColumnSchema] = []
    for field in fields:
        name = f"{prefix}{field.name}"
        columns.append(
            ColumnSchema(
                name=name,
                type=field.field_type,
                mode=field.mode,
                description=field.description,
            )
        )
        if field.field_type in ("RECORD", "STRUCT") and field.fields:
            columns.extend(_flatten_schema(list(field.fields), prefix=f"{name}."))
    return columns


def get_table_ref(client: bigquery.Client, table_id: str) -> bigquery.TableReference:
    return bigquery.TableReference.from_string(table_id, default_project=client.project)


def fetch_table_info(table_id: str) -> dict:
    client = state.require_client()
    table_ref = get_table_ref(client, table_id)
    table = client.get_table(table_ref)

    return {
        "table_id": table_id,
        "schema": [c.model_dump() for c in _flatten_schema(list(table.schema))],
        "num_rows": table.num_rows,
        "num_bytes": table.num_bytes,
        "size_human": human_size(table.num_bytes),
        "description": table.description,
        "created": table.created.isoformat() if table.created else None,
        "last_modified": table.modified.isoformat() if table.modified else None,
    }


def _json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def fetch_table_data(
    table_id: str,
    row_limit: int,
    where_clause: Optional[str],
    order_by: Optional[str],
    order_dir: Optional[str],
) -> dict:
    client = state.require_client()
    table_ref = get_table_ref(client, table_id)
    table = client.get_table(table_ref)  # also validates the table exists/is readable

    valid_columns = {f.name for f in table.schema}
    if order_by and order_by not in valid_columns:
        raise ValueError(f"Unknown column for order_by: {order_by}")

    direction = "DESC" if (order_dir or "").upper() == "DESC" else "ASC"
    limit = max(1, min(row_limit, config.MAX_ROW_LIMIT))

    full_table_name = f"`{table.project}`.`{table.dataset_id}`.`{table.table_id}`"
    query = f"SELECT * FROM {full_table_name}"
    if where_clause and where_clause.strip():
        query += f" WHERE {where_clause.strip()}"
    if order_by:
        query += f" ORDER BY `{order_by}` {direction}"
    query += f" LIMIT {limit + 1}"

    job = client.query(query)
    result = job.result()

    columns = [field.name for field in result.schema]
    rows = []
    for row in result:
        rows.append({key: _json_safe(value) for key, value in dict(row.items()).items()})

    truncated = len(rows) > limit
    if truncated:
        rows = rows[:limit]

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "bytes_billed": job.total_bytes_billed,
    }
