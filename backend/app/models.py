from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ServiceAccountRequest(BaseModel):
    path: str


class StatusResponse(BaseModel):
    configured: bool
    service_account_path: Optional[str] = None
    service_account_email: Optional[str] = None
    project_id: Optional[str] = None
    error: Optional[str] = None


class SavedTable(BaseModel):
    label: str
    table_id: str


class ColumnSchema(BaseModel):
    name: str
    type: str
    mode: str
    description: Optional[str] = None


class TableInfoRequest(BaseModel):
    table_id: str


class TableInfoResponse(BaseModel):
    table_id: str
    schema_: List[ColumnSchema] = Field(alias="schema")
    num_rows: Optional[int] = None
    num_bytes: Optional[int] = None
    size_human: Optional[str] = None
    description: Optional[str] = None
    created: Optional[str] = None
    last_modified: Optional[str] = None

    class Config:
        populate_by_name = True


class TableDataRequest(BaseModel):
    table_id: str
    row_limit: int = 5000
    where_clause: Optional[str] = None
    order_by: Optional[str] = None
    order_dir: Optional[str] = "ASC"


class TableDataResponse(BaseModel):
    columns: List[str]
    rows: List[dict[str, Any]]
    row_count: int
    truncated: bool
    bytes_billed: Optional[int] = None
