import { parseOCRToTable } from '../utils/parseOCRData'
import './DateSummaryTable.css'

function DateSummaryTable({ date, records }) {
  if (!records || records.length === 0) {
    return <div className="no-data">No data for this date.</div>
  }

  // For each record (image) on this date, parse the JSON/text and merge.
  // Since GPT returns fixed headers/rows per image, and we're currently
  // only using 1 image per date, we just take the first parsed table.
  const parsedList = records.map((r) => parseOCRToTable(r.text || ''))
  const primary = parsedList[0]

  const headers = primary.headers || []
  const rows = primary.rows || []

  return (
    <div className="date-table-container">
      <div className="date-table-header">
        <h2>Results for {date}</h2>
      </div>
      <div className="table-wrapper">
        <table className="data-table fixed-layout">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {headers.map((h) => (
                  <td key={h}>
                    {row[h] === null || row[h] === undefined || row[h] === ''
                      ? ''
                      : row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DateSummaryTable


