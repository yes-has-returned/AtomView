import os
import warnings
from contextlib import contextmanager
import psycopg2
from psycopg2 import OperationalError


@contextmanager
def get_db_connection():
    """Context manager yielding a psycopg2 connection or None on failure.

    Tries an internal URL then an external URL (if provided via env vars).
    If both fail, yields None and issues a warning.
    """
    internal_url = "postgresql://community:Mnc6wwt2UaL1EkhOF2iW2q0Ss9uHEPlU@dpg-d8e9mucp3tds738cd1n0-a/community_database_s4tu"
    external_url = "postgresql://community:Mnc6wwt2UaL1EkhOF2iW2q0Ss9uHEPlU@dpg-d8e9mucp3tds738cd1n0-a.oregon-postgres.render.com/community_database_s4tu"

    conn = None
    # Try internal/primary URL first
    if internal_url:
        try:
            conn = psycopg2.connect(internal_url, connect_timeout=3)
        except OperationalError:
            conn = None

    # Fallback to external if provided and internal failed
    if conn is None and external_url:
        try:
            conn = psycopg2.connect(external_url, sslmode='require', connect_timeout=5)
        except OperationalError:
            conn = None

    if conn is None:
        warnings.warn("Database unavailable. Check your DATABASE_URL or connection settings.")

    try:
        yield conn
        if conn:
            conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def initiate_database():
    with get_db_connection() as conn:
        if conn is None:
            return
        cur = conn.cursor()
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS community_molecules (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            smiles_code TEXT NOT NULL,
            upvotes INTEGER DEFAULT 0,
            downvotes INTEGER DEFAULT 0
        );
        """
        )
        cur.close()

def insert_community_sourced(name, smiles):
    with get_db_connection() as conn:
        if conn is None:
            warnings.warn("Database unavailable when inserting community entry.")
            raise ConnectionError("Database unavailable; please check your connection settings.")
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO community_molecules (name, smiles_code, upvotes, downvotes) VALUES (%s, %s, 0, 0)",
            (name, smiles)
        )
        cur.close()


def query_community_entries(name):
    with get_db_connection() as conn:
        if conn is None:
            warnings.warn("Database unavailable when querying community entries.")
            raise ConnectionError("Database unavailable; please check your connection settings.")
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, smiles_code, upvotes, downvotes FROM community_molecules WHERE LOWER(name) = LOWER(%s)",
            (name,)
        )
        rows = cur.fetchall()
        cur.close()

    entries = [
        {
            "id": row[0],
            "name": row[1],
            "smiles": row[2],
            "upvotes": row[3],
            "downvotes": row[4],
            "score": row[3] - row[4]
        }
        for row in rows
    ]
    entries.sort(key=lambda entry: (entry["score"], entry["upvotes"]), reverse=True)
    return entries


def _ensure_votes_table():
    with get_db_connection() as conn:
        if conn is None:
            warnings.warn("Database unavailable when ensuring votes table.")
            raise ConnectionError("Database unavailable; please check your connection settings.")
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS community_votes (
                id SERIAL PRIMARY KEY,
                entry_id INTEGER REFERENCES community_molecules(id),
                voter_id TEXT,
                vote TEXT,
                UNIQUE(entry_id, voter_id)
            )
            """
        )
        cur.close()


def adjust_community_vote(entry_id, voter_id, vote):
    """
    Enforce one vote per `voter_id` per community entry.
    `vote` may be 'up', 'down' or 'none' (to remove vote).
    Returns current up/down counts and stored vote for this voter.
    """
    if vote not in ('up', 'down', 'none'):
        raise ValueError('Invalid vote value')

    _ensure_votes_table()
    with get_db_connection() as conn:
        if conn is None:
            warnings.warn("Database unavailable when adjusting vote.")
            raise ConnectionError("Database unavailable; please check your connection settings.")
        cur = conn.cursor()

        cur.execute("SELECT vote FROM community_votes WHERE entry_id = %s AND voter_id = %s", (entry_id, voter_id))
        row = cur.fetchone()
        prev = row[0] if row else None

        # No-op if attempting to set same vote again
        if prev == vote and vote in ('up', 'down'):
            cur.execute("SELECT upvotes, downvotes FROM community_molecules WHERE id = %s", (entry_id,))
            counts = cur.fetchone()
            cur.close()
            return {"upvotes": counts[0], "downvotes": counts[1], "vote": prev}

        if vote == 'none':
            if prev is not None:
                cur.execute("DELETE FROM community_votes WHERE entry_id = %s AND voter_id = %s", (entry_id, voter_id))
                if prev == 'up':
                    cur.execute("UPDATE community_molecules SET upvotes = GREATEST(0, upvotes - 1) WHERE id = %s", (entry_id,))
                else:
                    cur.execute("UPDATE community_molecules SET downvotes = GREATEST(0, downvotes - 1) WHERE id = %s", (entry_id,))

        else:
            if prev is None:
                cur.execute("INSERT INTO community_votes (entry_id, voter_id, vote) VALUES (%s, %s, %s)", (entry_id, voter_id, vote))
                if vote == 'up':
                    cur.execute("UPDATE community_molecules SET upvotes = upvotes + 1 WHERE id = %s", (entry_id,))
                else:
                    cur.execute("UPDATE community_molecules SET downvotes = downvotes + 1 WHERE id = %s", (entry_id,))
            else:
                cur.execute("UPDATE community_votes SET vote = %s WHERE entry_id = %s AND voter_id = %s", (vote, entry_id, voter_id))
                if vote == 'up':
                    cur.execute("UPDATE community_molecules SET upvotes = upvotes + 1, downvotes = GREATEST(0, downvotes - 1) WHERE id = %s", (entry_id,))
                else:
                    cur.execute("UPDATE community_molecules SET downvotes = downvotes + 1, upvotes = GREATEST(0, upvotes - 1) WHERE id = %s", (entry_id,))

        # fetch updated counts
        cur.execute("SELECT upvotes, downvotes FROM community_molecules WHERE id = %s", (entry_id,))
        counts = cur.fetchone()

        # determine stored vote for this voter
        cur.execute("SELECT vote FROM community_votes WHERE entry_id = %s AND voter_id = %s", (entry_id, voter_id))
        vrow = cur.fetchone()
        stored_vote = vrow[0] if vrow else None

        cur.close()
        return {"upvotes": counts[0], "downvotes": counts[1], "vote": stored_vote}