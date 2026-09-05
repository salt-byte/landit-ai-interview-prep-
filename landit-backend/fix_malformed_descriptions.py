"""
One-off data repair for the resume-parser bug where Gemini returned
workExperience.description / project.projectDescription as a JSON array of
bullet strings instead of a single newline-joined string. The old
_normalize_output() in services/resume_parser.py called str() on that list,
storing the literal Python repr (e.g. "['• bullet one', '• bullet two']") in
the database. The frontend renders bullets by splitting on '\n', so those
rows show up as one garbled line instead of a bullet list.

The parser bug itself is already fixed (resume_parser.py clean_str() now
joins list values with '\n'), so this script only needs to run once against
existing data to repair rows written before the fix.

Run against the real database (uses DATABASE_URL from the environment/.env,
same as the app):

    cd landit-backend
    python fix_malformed_descriptions.py --dry-run   # preview affected rows
    python fix_malformed_descriptions.py             # apply the fix
"""
import argparse
import ast
import asyncio

from sqlalchemy import select

from database import AsyncSessionLocal
from models.user import WorkExperience, Project


def _looks_like_stringified_list(value: str) -> bool:
    v = value.strip()
    if not (v.startswith("[") and v.endswith("]")):
        return False
    return "', '" in v or '", "' in v or v.startswith("['") or v.startswith('["')


def _repair(value: str) -> str | None:
    if not value or not _looks_like_stringified_list(value):
        return None
    try:
        parsed = ast.literal_eval(value.strip())
    except (ValueError, SyntaxError):
        return None
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        return None
    return "\n".join(item.strip() for item in parsed if item.strip())


async def main(dry_run: bool) -> None:
    fixed = 0
    async with AsyncSessionLocal() as db:
        exp_rows = (await db.execute(select(WorkExperience))).scalars().all()
        for exp in exp_rows:
            repaired = _repair(exp.description)
            if repaired is None:
                continue
            print(f"WorkExperience id={exp.id} profile_id={exp.profile_id}: {exp.description!r} -> {repaired!r}")
            if not dry_run:
                exp.description = repaired
            fixed += 1

        proj_rows = (await db.execute(select(Project))).scalars().all()
        for proj in proj_rows:
            repaired = _repair(proj.project_description)
            if repaired is None:
                continue
            print(f"Project id={proj.id} profile_id={proj.profile_id}: {proj.project_description!r} -> {repaired!r}")
            if not dry_run:
                proj.project_description = repaired
            fixed += 1

        if not dry_run and fixed:
            await db.commit()

    print(f"{'Would fix' if dry_run else 'Fixed'} {fixed} row(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report affected rows without writing changes")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
