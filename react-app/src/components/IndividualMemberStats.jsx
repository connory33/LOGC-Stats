import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import './IndividualMemberStats.css'

// Varied color palette for pie chart - less green, more diversity
const COLORS = ['#5a7c4a', '#8b6f47', '#a0826d', '#6b8e5a', '#9d7e5f', '#4a6b3a', '#c4a574', '#7a9c6a', '#d4a574', '#6d8b5a', '#b8956a', '#8b7355', '#9d8b6f', '#a68b6d']

function IndividualMemberStats({ sheets }) {
  const [selectedMember, setSelectedMember] = useState('')
  const [hoveredSpecies, setHoveredSpecies] = useState(null)
  
  // Process all sheets data into member-specific analytics
  const memberData = useMemo(() => {
    if (!sheets || sheets.length === 0) {
      return null
    }
    
    try {
      const memberRecords = {}
      const allMembers = new Set()
      
      // Process each sheet
      sheets.forEach(sheet => {
        const headers = sheet.headers || []
        const rows = sheet.rows || []
        const date = sheet.name || 'Unknown'
        
        // Find column indices
        const memberIdx = headers.findIndex(h => h.toLowerCase().includes('member'))
        const guideIdx = headers.findIndex(h => h.toLowerCase().includes('guide'))
        const blindIdx = headers.findIndex(h => h.toLowerCase().includes('blind'))
        const gunsIdx = headers.findIndex(h => h.toLowerCase().includes('gun'))
        
        // Species columns
        const speciesCols = headers
          .map((h, idx) => ({ name: h, idx }))
          .filter(({ name }) => {
            const lower = name.toLowerCase()
            return (lower.includes('mallard') || lower.includes('sprig') || lower.includes('widgeon') ||
                   lower.includes('teal') || lower.includes('wood') || lower.includes('other') ||
                   lower.includes('geese') || lower.includes('pheasant')) &&
                   !lower.includes('day total') && !lower.includes('hunter total')
          })
        
        rows.forEach(row => {
          const member = (row[headers[memberIdx]] || '').toString().trim()
          const guide = (row[headers[guideIdx]] || '').toString().trim()
          const blind = (row[headers[blindIdx]] || '').toString().trim()
          const guns = parseFloat(row[headers[gunsIdx]] || 0) || 0
          
          // Skip header row, empty rows, and totals
          const memberLower = member.toLowerCase()
          if (!member || memberLower === 'member' || member === '' || 
              memberLower.includes('day total') || memberLower.includes('total')) {
            return
          }
          
          allMembers.add(member)
          
          if (!memberRecords[member]) {
            memberRecords[member] = {
              name: member,
              hunts: [],
              totalDucks: 0,
              totalGeese: 0,
              totalHunts: 0,
              speciesKills: {},
              blindStats: {},
              guideStats: {},
              dateStats: {}
            }
          }
          
          let totalDucks = 0
          let totalGeese = 0
          const speciesKills = {}
          
          speciesCols.forEach(({ name }) => {
            const rawValue = row[name] || ''
            const value = parseFloat(rawValue) || 0
            if (!isNaN(value) && value > 0) {
              speciesKills[name] = value
              // Separate ducks from geese
              const nameLower = name.toLowerCase()
              if (nameLower.includes('geese')) {
                totalGeese += value
              } else {
                // All other species are ducks
                totalDucks += value
              }
            }
          })
          
          if (totalDucks === 0 && totalGeese === 0 && guns === 0) return // Skip empty rows
          
          // Track mallards separately
          const drakeMallard = parseFloat(row['Drake Mallard'] || row[headers.find(h => h.toLowerCase().includes('drake') && h.toLowerCase().includes('mallard'))] || 0) || 0
          const henMallard = parseFloat(row['Hen Mallard'] || row[headers.find(h => h.toLowerCase().includes('hen') && h.toLowerCase().includes('mallard'))] || 0) || 0
          const totalMallards = drakeMallard + henMallard
          
          const huntRecord = {
            date,
            guide,
            blind: String(blind || 'Unknown'),
            guns,
            totalDucks,
            totalGeese,
            totalMallards,
            speciesKills
          }
          
          memberRecords[member].hunts.push(huntRecord)
          memberRecords[member].totalDucks += totalDucks
          memberRecords[member].totalGeese += totalGeese
          memberRecords[member].totalHunts += 1
          
          // Aggregate species stats
          Object.entries(speciesKills).forEach(([species, count]) => {
            memberRecords[member].speciesKills[species] = (memberRecords[member].speciesKills[species] || 0) + count
          })
          
          // Track blind usage
          if (blind && blind !== 'Unknown') {
            const blindKey = String(blind)
            if (!memberRecords[member].blindStats[blindKey]) {
              memberRecords[member].blindStats[blindKey] = { ducks: 0, geese: 0, hunts: 0, mallards: 0 }
            }
            memberRecords[member].blindStats[blindKey].ducks += totalDucks
            memberRecords[member].blindStats[blindKey].geese += totalGeese
            memberRecords[member].blindStats[blindKey].mallards += totalMallards
            memberRecords[member].blindStats[blindKey].hunts += 1
          }
          
          // Track guide usage
          if (guide) {
            if (!memberRecords[member].guideStats[guide]) {
              memberRecords[member].guideStats[guide] = { ducks: 0, geese: 0, hunts: 0 }
            }
            memberRecords[member].guideStats[guide].ducks += totalDucks
            memberRecords[member].guideStats[guide].geese += totalGeese
            memberRecords[member].guideStats[guide].hunts += 1
          }
          
          // Track date stats
          if (!memberRecords[member].dateStats[date]) {
            memberRecords[member].dateStats[date] = { ducks: 0, geese: 0 }
          }
          memberRecords[member].dateStats[date].ducks += totalDucks
          memberRecords[member].dateStats[date].geese += totalGeese
        })
      })
      
      // Convert to array and calculate averages
      const membersArray = Object.values(memberRecords).map(member => {
        const totalDucks = member.totalDucks || 0
        const totalGeese = member.totalGeese || 0
        const total = totalDucks + totalGeese
        const totalMallards = member.hunts.reduce((sum, hunt) => sum + (hunt.totalMallards || 0), 0)
        const avgDucksPerHunt = member.totalHunts > 0 ? totalDucks / member.totalHunts : 0
        const avgGeesePerHunt = member.totalHunts > 0 ? totalGeese / member.totalHunts : 0
        const avgMallardsPerHunt = member.totalHunts > 0 ? totalMallards / member.totalHunts : 0
        
        // Convert blind stats to array with averages
        const blindArray = Object.entries(member.blindStats).map(([name, stats]) => ({
          name,
          ducks: stats.ducks || 0,
          geese: stats.geese || 0,
          total: (stats.ducks || 0) + (stats.geese || 0),
          hunts: stats.hunts,
          mallards: stats.mallards || 0,
          avgDucks: stats.hunts > 0 ? (stats.ducks || 0) / stats.hunts : 0,
          avgGeese: stats.hunts > 0 ? (stats.geese || 0) / stats.hunts : 0,
          avgMallards: stats.hunts > 0 ? (stats.mallards || 0) / stats.hunts : 0
        })).sort((a, b) => b.total - a.total)
        
        // Convert guide stats to array with averages
        const guideArray = Object.entries(member.guideStats).map(([name, stats]) => ({
          name,
          ducks: stats.ducks || 0,
          geese: stats.geese || 0,
          total: (stats.ducks || 0) + (stats.geese || 0),
          hunts: stats.hunts,
          avgDucks: stats.hunts > 0 ? (stats.ducks || 0) / stats.hunts : 0,
          avgGeese: stats.hunts > 0 ? (stats.geese || 0) / stats.hunts : 0,
          average: stats.hunts > 0 ? ((stats.ducks || 0) + (stats.geese || 0)) / stats.hunts : 0
        })).sort((a, b) => b.total - a.total)
        
        // Convert species stats to array
        const speciesArray = Object.entries(member.speciesKills)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
        
        // Convert date stats to array for trend chart
        // Parse dates and sort properly
        const parseDate = (dateStr) => {
          if (dateStr.includes('_')) {
            const parts = dateStr.split('_')
            if (parts.length === 3) {
              const month = parseInt(parts[0], 10) - 1
              const day = parseInt(parts[1], 10)
              let year = parseInt(parts[2], 10)
              if (year < 100) year += 2000
              return new Date(year, month, day).getTime()
            }
          }
          return new Date(dateStr).getTime()
        }
        
        const formatDate = (dateStr) => {
          if (dateStr.includes('_')) {
            const parts = dateStr.split('_')
            if (parts.length === 3) {
              return `${parts[0]}/${parts[1]}/${parts[2]}`
            }
          }
          // Try to parse and format other date formats
          try {
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
              const month = date.getMonth() + 1
              const day = date.getDate()
              const year = date.getFullYear().toString().slice(-2)
              return `${month}/${day}/${year}`
            }
          } catch (e) {
            // Fallback to original string
          }
          return dateStr
        }
        
        // Get all unique dates from all sheets (to show all dates, even if member didn't hunt)
        const allDates = new Set()
        sheets.forEach(sheet => {
          const date = sheet.name || 'Unknown'
          if (date !== 'Unknown') {
            allDates.add(date)
          }
        })
        
        // Build dateArray with all dates, including those where member didn't hunt
        // Use the member's hunt records which already have the correct blind data
        const dateArray = Array.from(allDates).map(date => {
          // Find hunts for this date - use exact string match first, then normalized
          const huntsForDate = member.hunts.filter(h => {
            // Try exact match first
            if (String(h.date).trim() === String(date).trim()) {
              return true
            }
            // Then try normalized match
            const normalizeDate = (d) => String(d).trim().toLowerCase()
            return normalizeDate(h.date) === normalizeDate(date)
          })
          
          if (huntsForDate.length > 0) {
            // Check if any hunt has a valid blind (not empty, not "Unknown")
            // The blind is stored as String(blind || 'Unknown'), so if it was empty it's 'Unknown'
            const hasValidBlind = huntsForDate.some(h => {
              // h.blind could be string or number - convert to string and check
              let blind = h.blind
              if (blind == null || blind === undefined) {
                return false
              }
              // Convert to string, handling both string and number
              blind = String(blind).trim()
              // Check if blind has a real value (not empty, not "Unknown", not "-", not "0")
              if (!blind || blind === '' || blind === '-' || blind === '0') {
                return false
              }
              if (blind.toLowerCase() === 'unknown') {
                return false
              }
              // If we get here, blind has a valid value
              return true
            })
            
            // Calculate totals from hunts
            const totalDucks = huntsForDate.reduce((sum, hunt) => sum + (hunt.totalDucks || 0), 0)
            const totalGeese = huntsForDate.reduce((sum, hunt) => sum + (hunt.totalGeese || 0), 0)
            const totalMallards = huntsForDate.reduce((sum, hunt) => sum + (hunt.totalMallards || 0), 0)
            
            // Determine status: ONLY based on blind value - if blind has a value, they hunted; otherwise DNH
            const status = hasValidBlind ? 'hunted' : 'DNH'
            
            return { 
              date, 
              dateFormatted: formatDate(date),
              dateSort: parseDate(date),
              ducks: totalDucks,
              geese: totalGeese,
              mallards: totalMallards,
              total: totalDucks + totalGeese,
              status: status
            }
          } else {
            // Member didn't hunt on this date (no hunt records) - show "DNH"
            return {
              date,
              dateFormatted: formatDate(date),
              dateSort: parseDate(date),
              ducks: 0,
              geese: 0,
              mallards: 0,
              total: 0,
              status: 'DNH'
            }
          }
        }).sort((a, b) => a.dateSort - b.dateSort)
        
        // Sort hunts by date
        const parseDateForSort = (dateStr) => {
          if (dateStr.includes('_')) {
            const parts = dateStr.split('_')
            if (parts.length === 3) {
              const month = parseInt(parts[0], 10) - 1
              const day = parseInt(parts[1], 10)
              let year = parseInt(parts[2], 10)
              if (year < 100) year += 2000
              return new Date(year, month, day).getTime()
            }
          }
          return new Date(dateStr).getTime()
        }
        
        const sortedHunts = [...member.hunts].sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date))
        
        return {
          ...member,
          totalDucks,
          totalGeese,
          total,
          totalMallards,
          avgDucksPerHunt,
          avgGeesePerHunt,
          avgMallardsPerHunt,
          hunts: sortedHunts,
          blindArray,
          guideArray,
          speciesArray,
          dateArray
        }
      }).sort((a, b) => b.total - a.total)
      
      return {
        members: membersArray,
        memberNames: Array.from(allMembers).sort()
      }
    } catch (error) {
      console.error('Error processing member stats:', error)
      return null
    }
  }, [sheets])
  
  // Set default selected member
  useEffect(() => {
    if (memberData && memberData.memberNames.length > 0 && !selectedMember) {
      setSelectedMember(memberData.memberNames[0])
    }
  }, [memberData, selectedMember])
  
  if (!memberData || memberData.members.length === 0) {
    return <div className="individual-stats-empty">No member data available</div>
  }
  
  const selectedMemberData = memberData.members.find(m => m.name === selectedMember) || memberData.members[0]
  
  if (!selectedMemberData) {
    return <div className="individual-stats-empty">Select a member to view stats</div>
  }
  
      return (
        <div className="individual-member-stats">
      
      {/* Member Selector */}
      <div className="member-selector">
        <label htmlFor="member-select">Select Member:</label>
        <select
          id="member-select"
          value={selectedMember || selectedMemberData.name}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="member-select"
        >
          {memberData.memberNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="member-days-display">
          <div className="member-days-label">Total Days</div>
          <div className="member-days-value">{selectedMemberData.totalHunts}</div>
        </div>
      </div>
      
      {/* Member Summary Stats */}
      <div className="member-summary-stats">
        <div className="member-stats-container">
          <div className="member-stats-main">
            <div className="member-stats-section">
              <h4 className="member-stats-section-title">Totals</h4>
              <div className="member-stats-table">
                <div className="member-stat-row">
                  <div className="member-stat-label">Total Ducks:</div>
                  <div className="member-stat-value">{selectedMemberData.totalDucks || 0}</div>
                </div>
                <div className="member-stat-row">
                  <div className="member-stat-label">Total Geese:</div>
                  <div className="member-stat-value">{selectedMemberData.totalGeese || 0}</div>
                </div>
                <div className="member-stat-row">
                  <div className="member-stat-label">Total Mallards:</div>
                  <div className="member-stat-value">{selectedMemberData.totalMallards || 0}</div>
                </div>
              </div>
            </div>
            <div className="member-stats-section">
              <h4 className="member-stats-section-title">Averages</h4>
              <div className="member-stats-table">
                <div className="member-stat-row">
                  <div className="member-stat-label">Avg Ducks/Hunt:</div>
                  <div className="member-stat-value">{Math.round((selectedMemberData.avgDucksPerHunt || 0) * 10) / 10}</div>
                </div>
                <div className="member-stat-row">
                  <div className="member-stat-label">Avg Geese/Hunt:</div>
                  <div className="member-stat-value">{Math.round((selectedMemberData.avgGeesePerHunt || 0) * 10) / 10}</div>
                </div>
                <div className="member-stat-row">
                  <div className="member-stat-label">Avg Mallards/Hunt:</div>
                  <div className="member-stat-value">{Math.round((selectedMemberData.avgMallardsPerHunt || 0) * 10) / 10}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="member-charts-grid">
        {/* Species Breakdown */}
        {selectedMemberData.speciesArray.length > 0 && (
          <div className="member-chart-card">
            <h3>Species Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={selectedMemberData.speciesArray}
                  dataKey="total"
                  nameKey="name"
                  cx="35%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label={({ name, value }) => {
                    // Show label only for hovered item when hovering over legend
                    if (hoveredSpecies === name) {
                      return value
                    }
                    return null
                  }}
                  labelLine={false}
                >
                  {selectedMemberData.speciesArray.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      opacity={hoveredSpecies === null || hoveredSpecies === entry.name ? 1 : 0.3}
                      onMouseEnter={() => setHoveredSpecies(entry.name)}
                      onMouseLeave={() => setHoveredSpecies(null)}
                      style={{ 
                        transition: 'opacity 0.2s',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ paddingLeft: '20px' }}
                  content={({ payload }) => (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {payload.map((entry, index) => {
                        const speciesData = selectedMemberData.speciesArray.find(s => s.name === entry.value)
                        const value = speciesData ? speciesData.total : 0
                        return (
                          <li
                            key={`legend-${index}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              opacity: hoveredSpecies === null || hoveredSpecies === entry.value ? 1 : 0.3,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={() => setHoveredSpecies(entry.value)}
                            onMouseLeave={() => setHoveredSpecies(null)}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                width: '14px',
                                height: '14px',
                                backgroundColor: entry.color,
                                marginRight: '8px',
                                borderRadius: '2px'
                              }}
                            />
                            <span>{entry.value}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Kills Over Time */}
        {selectedMemberData.dateArray.length > 0 && (
          <div className="member-chart-card">
            <h3>Ducks & Geese Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
            <BarChart data={selectedMemberData.dateArray}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="dateFormatted" 
                angle={-90} 
                textAnchor="end" 
                height={120}
                interval={0}
                tickFormatter={(value, index) => {
                  const entry = selectedMemberData.dateArray[index]
                  if (entry && entry.status === 'DNH') {
                    return `${value}\n(DNH)`
                  }
                  return value
                }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name, props) => {
                  if (props.payload.status === 'DNH') {
                    return ['DNH', 'Status']
                  }
                  return [value, name]
                }}
              />
              <Legend />
              <Bar dataKey="ducks" stackId="a" fill="#000000" name="Ducks" />
              <Bar dataKey="geese" stackId="a" fill="#d4a574" name="Geese" />
              <Bar dataKey="mallards" stackId="a" fill="#2d5016" name="Mallards" />
            </BarChart>
            </ResponsiveContainer>
            {/* Show "Did not hunt" indicator for dates with no data */}
            {selectedMemberData.dateArray.some(d => d.status === 'DNH') && (
              <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
                Dates marked "(DNH)" indicate this member did not hunt on that day
              </div>
            )}
          </div>
        )}
        
        {/* Favorite Blinds Table */}
        {selectedMemberData.blindArray.length > 0 && (
          <div className="member-chart-card">
            <h3>Favorite Blinds</h3>
            <div className="blinds-table-container">
              <table className="blinds-table">
                <thead>
                  <tr>
                    <th>Blind</th>
                    <th>Times Hunted</th>
                    <th>Avg Ducks</th>
                    <th>Avg Geese</th>
                    <th>Avg Mallards</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMemberData.blindArray.map((blind, idx) => (
                    <tr key={idx}>
                      <td><strong>{blind.name}</strong></td>
                      <td>{blind.hunts}</td>
                      <td>{blind.avgDucks.toFixed(1)}</td>
                      <td>{blind.avgGeese.toFixed(1)}</td>
                      <td>{blind.avgMallards.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Guide Performance */}
        {selectedMemberData.guideArray.length > 0 && (
          <div className="member-chart-card">
            <h3>Guide Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={selectedMemberData.guideArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#000000" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Detailed Hunt History Table */}
      {selectedMemberData.hunts.length > 0 && (
        <div className="member-hunt-history">
          <h3>Hunt History</h3>
          <div className="hunt-history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Blind</th>
                  <th>Guide</th>
                  <th>Guns</th>
                  <th>Ducks</th>
                  <th>Geese</th>
                  <th>Species</th>
                </tr>
              </thead>
              <tbody>
                {selectedMemberData.hunts.map((hunt, idx) => {
                  // Format date
                  const formatDate = (dateStr) => {
                    if (dateStr.includes('_')) {
                      const parts = dateStr.split('_')
                      if (parts.length === 3) {
                        return `${parts[0]}/${parts[1]}/${parts[2]}`
                      }
                    }
                    try {
                      const date = new Date(dateStr)
                      if (!isNaN(date.getTime())) {
                        const month = date.getMonth() + 1
                        const day = date.getDate()
                        const year = date.getFullYear().toString().slice(-2)
                        return `${month}/${day}/${year}`
                      }
                    } catch (e) {
                      // Fallback
                    }
                    return dateStr
                  }
                  
                  // Format species list
                  const formatSpecies = (speciesKills) => {
                    if (!speciesKills || Object.keys(speciesKills).length === 0) {
                      return '-'
                    }
                    return Object.entries(speciesKills)
                      .filter(([species, count]) => count > 0)
                      .map(([species, count]) => `${count} ${species}`)
                      .join(', ')
                  }
                  
                  return (
                    <tr key={idx}>
                      <td>{formatDate(hunt.date)}</td>
                      <td>{hunt.blind}</td>
                      <td>{hunt.guide || '-'}</td>
                      <td>{hunt.guns || '-'}</td>
                      <td><strong>{hunt.totalDucks || 0}</strong></td>
                      <td><strong>{hunt.totalGeese || 0}</strong></td>
                      <td>{formatSpecies(hunt.speciesKills)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndividualMemberStats

