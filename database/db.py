import os

import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()


def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        parsed = urlparse(database_url)
        return psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            dbname=(parsed.path or "/").lstrip("/") or "postgres",
            user=parsed.username,
            password=parsed.password,
            sslmode="require" if os.getenv("DATABASE_SSL", "").lower() == "true" else None,
        )
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "bayansafe"),
        user=os.getenv("DB_USER", "bayan_api"),
        password=os.getenv("DB_PASSWORD", ""),
    )


if __name__ == "__main__":
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT question_id, prompt FROM questions")
        for row in cur.fetchall():
            print(row)
