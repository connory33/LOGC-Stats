import { useState } from 'react'
import { parseOCRToTable } from '../utils/parseOCRData'
import './ImageTable.css'

function ImageTable({ filename, text }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const parsed = parseOCRToTable(text)

  return (
    <div className="image-table-container">
      <div className="image-table-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="image-table-title">
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3>{filename}</h3>
          {parsed.metadata.date && (
            <span className="metadata-badge">Date: {parsed.metadata.date}</span>
          )}
          {parsed.metadata.recordType && (
            <span className="metadata-badge">{parsed.metadata.recordType}</span>
          )}
        </div>
        <div className="row-count">{parsed.rows.length} rows</div>
      </div>

      {isExpanded && (
        <div className="image-table-content">
          {parsed.rows.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {parsed.headers.map((header, idx) => (
                      <th key={idx}>{header || `Column ${idx + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {parsed.headers.map((header, colIdx) => (
                        <td key={colIdx}>{row[header] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data-message">No structured data found</div>
          )}
          
          <div className="raw-text-toggle">
            <details>
              <summary>View Raw OCR Text</summary>
              <pre className="raw-text">{text}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageTable

