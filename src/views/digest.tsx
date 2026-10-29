import type { NightRead } from '../digest/types.js';

export function DigestPage({ night, read }: { night: string; read: NightRead }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {read.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {read.rows.map((row) => {
              const marked = row.retries >= 3 || row.lastStatus === 'fail';
              return (
                <tr class={marked ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {read.badLines > 0 ? <p class="mute">{read.badLines} line not read</p> : null}
    </>
  );
}
