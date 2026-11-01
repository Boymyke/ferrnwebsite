#!/usr/bin/env python3
"""
Imports the LeadsHunter "Ferrn Command Centre" export into SQL for D1.

    python3 scripts/import_command_centre.py <export-file> > migrations/seed/leads.sql
    npx wrangler d1 execute ferrn-db --remote --file=migrations/seed/leads.sql

The export is the multi-sheet text format ("## Sheet name: Leads" followed by CSV).
A plain Leads CSV also works. Output is INSERT OR REPLACE so it can be re-run.
After the first import the Worker's cron keeps leads in sync with the engine.
"""
import csv, io, sys, re
from datetime import datetime

COLS = ['id','created','niche','company','website','email','phone','contact_name','role','city','tier','score','gaps',
        'pitch','est_value','status','preview_url','last_contact','last_reply','next_action','needs_you','needs_you_reason',
        'notes','source','thread_id']

def sheet(text, name):
    m = re.search(r'## Sheet name: ' + re.escape(name) + r'\n(.*?)(?=\n## Sheet name: |\Z)', text, re.S)
    return m.group(1) if m else text

def iso(d):
    d = (d or '').strip()
    for fmt in ('%m/%d/%Y', '%m/%d/%Y %H:%M:%S', '%Y-%m-%d'):
        try: return datetime.strptime(d, fmt).strftime('%Y-%m-%d')
        except ValueError: pass
    return d or None

def q(v):
    if v is None or v == '': return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"

def main():
    text = open(sys.argv[1], encoding='utf-8').read()
    rows = list(csv.DictReader(io.StringIO(sheet(text, 'Leads').strip())))
    print('-- LeadsHunter import, %d leads' % len(rows))
    for r in rows:
        if not r.get('id'): continue
        vals = {k: (r.get(k) or '').strip() for k in COLS}
        for k in ('created','last_contact','last_reply'): vals[k] = iso(vals[k])
        for k in ('score','est_value'): vals[k] = re.sub(r'[^0-9]', '', vals[k] or '') or None
        cols = COLS + ['origin','synced_at']
        values = [q(vals[k]) if k not in ('score','est_value') else (vals[k] or 'NULL') for k in COLS] + ["'engine'", "datetime('now')"]
        print(f"INSERT OR REPLACE INTO leads ({','.join(cols)}) VALUES ({','.join(values)});")

if __name__ == '__main__':
    main()
