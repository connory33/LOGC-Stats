import { useState, useMemo } from 'react'
import './DataTable.css'

function DataTable({ data }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [expandedRows, setExpandedRows] = useState(new Set())

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    
    const term = searchTerm.toLowerCase()
    return data.filter(row => {
      return Object.values(row).some(value => 
        String(value).toLowerCase().includes(term)
      )
    })
  }, [data, searchTerm])

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key] || ''
      const bVal = b[sortConfig.key] || ''
      
      if (sortConfig.direction === 'asc') {
        return String(aVal).localeCompare(String(bVal))
      } else {
        return String(bVal).localeCompare(String(aVal))
      }
    })
  }, [filteredData, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleRow = (index) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const truncateText = (text, maxLength = 100) => {
    if (!text) return ''
    const str = String(text)
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
  }

  if (!data || data.length === 0) {
    return <div className="no-data">No data available</div>
  }

  const columns = Object.keys(data[0] || {})

  return (
    <div className="data-table-container">
      <div className="table-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="table-info">
          Showing {sortedData.length} of {data.length} records
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={sortConfig.key === col ? `sorted ${sortConfig.direction}` : ''}
                >
                  {col}
                  {sortConfig.key === col && (
                    <span className="sort-indicator">
                      {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
              <th className="expand-header">View</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => {
              const isExpanded = expandedRows.has(rowIndex)
              return (
                <tr key={rowIndex} className={isExpanded ? 'expanded' : ''}>
                  {columns.map((col) => (
                    <td key={col}>
                      {col === 'text' && !isExpanded
                        ? truncateText(row[col])
                        : String(row[col] || '')}
                    </td>
                  ))}
                  <td className="expand-cell">
                    <button
                      onClick={() => toggleRow(rowIndex)}
                      className="expand-button"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && searchTerm && (
        <div className="no-results">
          No results found for "{searchTerm}"
        </div>
      )}
    </div>
  )
}

export default DataTable

