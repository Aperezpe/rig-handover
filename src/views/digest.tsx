import type { DigestRow, Night } from '../digest/types.js';

// Retries of 3 or more, and any fail, are the rows a reader must see first.
const RETRY_FLAG = 3;

export function flagged(row: DigestRow): boolean {
  return row.lastStatus === 'fail' || row.retries >= RETRY_FLAG;
}

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);

export function Digest({ digest }: { digest: Night }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={flagged(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{dash(row.owner)}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{flagged(row) ? `${row.lastStatus} ⚠` : row.lastStatus}</td>
                <td>{dash(row.lastError)}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 ? (
        <p class="mute">{digest.badLines} unreadable line(s) skipped</p>
      ) : null}
    </>
  );
}
