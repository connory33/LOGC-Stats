import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
import './AnalyticsDashboard.css'

// Natural, earthy color palette matching hunting/wetland theme
const COLORS = ['#5a7c4a', '#6b8e5a', '#8b6f47', '#a0826d', '#4a6b3a', '#3d5a2f', '#7a9c6a', '#9d7e5f', '#6d8b5a', '#5a6b4a']

function AnalyticsDashboard({ sheets }) {
  const [selectedCondition, setSelectedCondition] = useState('all')
  
  // Process all sheets data into analytics
  const analytics = useMemo(() => {
    if (!sheets || sheets.length === 0) {
      console.log('AnalyticsDashboard: No sheets provided')
      return null
    }
    
    try {

    const allRecords = []
    const memberStats = {}
    const blindStats = {}
    const speciesStats = {}
    const dateStats = {}
    const guideStats = {}
    const memberBlindStats = {}
    const memberSpeciesStats = {}
    let totalMallardsCount = 0

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
      const dateColIdx = headers.findIndex(h => h.toLowerCase() === 'date')
      const weatherIdx = headers.findIndex(h => h.toLowerCase().includes('weather') || h.toLowerCase().includes('condition'))
      
      // Find the date value column (the one with actual date format or weather values)
      const dateValueCol = headers.find(h => h.match(/^\d{4}-\d{2}-\d{2}/))
      
      // Extract condition for this sheet (one condition per hunt/sheet)
      let sheetCondition = 'Unknown'
      const conditionRow = rows.find(r => {
        if (dateColIdx >= 0 && r[headers[dateColIdx]]) {
          const label = r[headers[dateColIdx]].toString().trim().toLowerCase()
          return label === 'conditions' || label === 'condition'
        }
        return false
      })
      
      if (conditionRow && dateValueCol && conditionRow[dateValueCol]) {
        const conditionValue = conditionRow[dateValueCol].toString().trim()
        if (conditionValue && !conditionValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          sheetCondition = conditionValue
        }
      }
      
      // Species columns (exclude "Day Total" and "Hunter Total")
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
        // Access row by header name directly, not by index
        const member = (row[headers[memberIdx]] || '').toString().trim()
        const guide = (row[headers[guideIdx]] || '').toString().trim()
        const blind = (row[headers[blindIdx]] || '').toString().trim()
        const guns = parseFloat(row[headers[gunsIdx]] || 0) || 0
        
        // Use the condition extracted for this sheet (one condition per hunt)
        const condition = sheetCondition
        
        // Skip header row, empty rows, and "Day Total" entries
        const memberLower = member.toLowerCase()
        if (!member || memberLower === 'member' || member === '' || 
            memberLower.includes('day total') || memberLower.includes('total')) {
          return
        }

        let totalKills = 0
        const speciesKills = {}

        speciesCols.forEach(({ name, idx }) => {
          const rawValue = row[name] || row[headers[idx]] || ''
          const value = parseFloat(rawValue) || 0
          if (!isNaN(value) && value > 0) {
            speciesKills[name] = value
            totalKills += value
          }
        })
        
        // Calculate total mallards for this record (Drake + Hen)
        const drakeMallard = parseFloat(row['Drake Mallard'] || row[headers.find(h => h.toLowerCase().includes('drake') && h.toLowerCase().includes('mallard'))] || 0) || 0
        const henMallard = parseFloat(row['Hen Mallard'] || row[headers.find(h => h.toLowerCase().includes('hen') && h.toLowerCase().includes('mallard'))] || 0) || 0
        const recordMallards = drakeMallard + henMallard

        if (totalKills === 0 && guns === 0) return // Skip empty rows

        const record = {
          date,
          member,
          guide,
          blind: String(blind || 'Unknown'),
          guns,
          condition,
          totalKills,
          speciesKills,
          totalMallards: recordMallards
        }

        allRecords.push(record)
        totalMallardsCount += recordMallards

        // Aggregate stats
        if (member) {
          memberStats[member] = (memberStats[member] || 0) + totalKills
          if (!memberSpeciesStats[member]) memberSpeciesStats[member] = {}
          Object.entries(speciesKills).forEach(([species, count]) => {
            memberSpeciesStats[member][species] = (memberSpeciesStats[member][species] || 0) + count
          })
        }

        if (blind && blind !== 'Unknown') {
          const blindKey = String(blind)
          blindStats[blindKey] = (blindStats[blindKey] || 0) + totalKills
          if (member && blind) {
            const key = `${member}-${blindKey}`
            memberBlindStats[key] = (memberBlindStats[key] || 0) + totalKills
          }
        }

        if (guide) {
          guideStats[guide] = (guideStats[guide] || 0) + totalKills
        }

        Object.entries(speciesKills).forEach(([species, count]) => {
          speciesStats[species] = (speciesStats[species] || 0) + count
        })

        dateStats[date] = (dateStats[date] || 0) + totalKills
      })
    })

    // Calculate number of hunts (unique dates)
    const numHunts = Object.keys(dateStats).length || 1

    // Convert to arrays for charts with averages
    const topMembers = Object.entries(memberStats)
      .map(([name, total]) => {
        // Count how many hunts this member participated in
        const memberHunts = allRecords.filter(r => r.member === name).length || 1
        return { 
          name, 
          total, 
          average: total / memberHunts,
          hunts: memberHunts
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const topMembersAvg = [...topMembers]
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)

    const topBlinds = Object.entries(blindStats)
      .filter(([name]) => name && name !== 'Unknown' && name !== '')
      .map(([name, total]) => {
        // Count how many hunts this blind was used (convert to string for comparison)
        const blindHunts = allRecords.filter(r => String(r.blind) === String(name)).length || 1
        return { 
          name: String(name), 
          total, 
          average: total / blindHunts,
          hunts: blindHunts
        }
      })
      .sort((a, b) => b.total - a.total)

    const topBlindsAvg = [...topBlinds]
      .sort((a, b) => b.average - a.average)

    const topSpecies = Object.entries(speciesStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    const dateTrends = Object.entries(dateStats)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))


    const topGuides = Object.entries(guideStats)
      .filter(([name]) => name)
      .map(([name, total]) => {
        // Count how many hunts this guide participated in
        const guideHunts = allRecords.filter(r => r.guide === name).length || 1
        return { 
          name, 
          total, 
          average: total / guideHunts,
          hunts: guideHunts
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topGuidesAvg = [...topGuides]
      .sort((a, b) => b.average - a.average)

    const totalHunts = sheets.length
    const totalKills = Object.values(memberStats).reduce((a, b) => a + b, 0)
    
    // Calculate average kills per member (across all members)
    const numMembers = Object.keys(memberStats).length
    const avgKillsPerMember = numMembers > 0 ? totalKills / numMembers : 0
    
    // Calculate total kills per hunt
    const totalKillsPerHunt = totalHunts > 0 ? totalKills / totalHunts : 0
    
    // Get unique conditions (filter out empty and Unknown)
    const uniqueConditions = [...new Set(allRecords.map(r => r.condition).filter(c => c && c.toString().trim() && c !== 'Unknown' && c.toLowerCase() !== 'unknown'))].sort()

      return {
        allRecords,
        uniqueConditions,
        topMembers,
        topMembersAvg,
        topBlinds,
        topBlindsAvg,
        topSpecies,
        dateTrends,
        topGuides,
        topGuidesAvg,
        memberBlindStats,
        memberSpeciesStats,
        stats: {
          totalHunts,
          totalKills,
          totalMallards: totalMallardsCount,
          avgKillsPerMember,
          totalKillsPerHunt,
          uniqueBlinds: Object.keys(blindStats).length
        }
      }
    } catch (error) {
      console.error('Error processing analytics:', error)
      return null
    }
  }, [sheets])

  if (!analytics) {
    return <div className="analytics-empty">No data available for analytics</div>
  }

  // Filter records based on selected condition
  const filteredRecords = useMemo(() => {
    if (selectedCondition === 'all') {
      return analytics.allRecords || []
    }
    return (analytics.allRecords || []).filter(r => r.condition === selectedCondition)
  }, [analytics, selectedCondition])

  // Recalculate stats based on filtered records
  const filteredAnalytics = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) {
      return null
    }

    const memberStats = {}
    const blindStats = {}
    const speciesStats = {}
    const dateStats = {}
    const guideStats = {}
    const memberBlindStats = {}
    const memberSpeciesStats = {}

    let filteredTotalMallards = 0
    filteredRecords.forEach(record => {
      const { member, guide, blind, condition, totalKills, speciesKills, date, totalMallards = 0 } = record
      filteredTotalMallards += totalMallards

      if (member) {
        memberStats[member] = (memberStats[member] || 0) + totalKills
        if (!memberSpeciesStats[member]) memberSpeciesStats[member] = {}
        Object.entries(speciesKills || {}).forEach(([species, count]) => {
          memberSpeciesStats[member][species] = (memberSpeciesStats[member][species] || 0) + count
        })
      }

      if (blind && blind !== 'Unknown') {
        const blindKey = String(blind)
        blindStats[blindKey] = (blindStats[blindKey] || 0) + totalKills
        if (member && blind) {
          const key = `${member}-${blindKey}`
          memberBlindStats[key] = (memberBlindStats[key] || 0) + totalKills
        }
      }

      if (guide) {
        guideStats[guide] = (guideStats[guide] || 0) + totalKills
      }

      Object.entries(speciesKills || {}).forEach(([species, count]) => {
        speciesStats[species] = (speciesStats[species] || 0) + count
      })

      dateStats[date] = (dateStats[date] || 0) + totalKills
    })

    const topMembers = Object.entries(memberStats)
      .map(([name, total]) => {
        const memberHunts = filteredRecords.filter(r => r.member === name).length || 1
        return { name, total, average: total / memberHunts, hunts: memberHunts }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const topMembersAvg = [...topMembers]
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)

    const topBlinds = Object.entries(blindStats)
      .filter(([name]) => name && name !== 'Unknown' && name !== '')
      .map(([name, total]) => {
        const blindHunts = filteredRecords.filter(r => String(r.blind) === String(name)).length || 1
        return { name: String(name), total, average: total / blindHunts, hunts: blindHunts }
      })
      .sort((a, b) => b.total - a.total)

    const topBlindsAvg = [...topBlinds]
      .sort((a, b) => b.average - a.average)

    const topSpecies = Object.entries(speciesStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    const dateTrends = Object.entries(dateStats)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const topGuides = Object.entries(guideStats)
      .filter(([name]) => name)
      .map(([name, total]) => {
        const guideHunts = filteredRecords.filter(r => r.guide === name).length || 1
        return { name, total, average: total / guideHunts, hunts: guideHunts }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topGuidesAvg = [...topGuides]
      .sort((a, b) => b.average - a.average)

    const totalHunts = new Set(filteredRecords.map(r => r.date)).size
    const totalKills = Object.values(memberStats).reduce((a, b) => a + b, 0)
    
    // Calculate average kills per member (across all members)
    const numMembers = Object.keys(memberStats).length
    const avgKillsPerMember = numMembers > 0 ? totalKills / numMembers : 0
    
    // Calculate total kills per hunt
    const totalKillsPerHunt = totalHunts > 0 ? totalKills / totalHunts : 0

    return {
      topMembers,
      topMembersAvg,
      topBlinds,
      topBlindsAvg,
      topSpecies,
      dateTrends,
      topGuides,
      topGuidesAvg,
      stats: {
        totalHunts,
        totalKills,
        totalMallards: filteredTotalMallards,
        avgKillsPerMember,
        totalKillsPerHunt,
        uniqueBlinds: Object.keys(blindStats).length
      }
    }
  }, [filteredRecords])

  // Use filtered analytics if available, otherwise use full analytics
  const displayAnalytics = filteredAnalytics || analytics

  // Safely destructure with defaults
  const stats = displayAnalytics.stats || {}
  const topMembers = displayAnalytics.topMembers || []
  const topMembersAvg = displayAnalytics.topMembersAvg || []
  const topBlinds = displayAnalytics.topBlinds || []
  const topBlindsAvg = displayAnalytics.topBlindsAvg || []
  const topSpecies = displayAnalytics.topSpecies || []
  const dateTrends = displayAnalytics.dateTrends || []
  const topGuides = displayAnalytics.topGuides || []
  const topGuidesAvg = displayAnalytics.topGuidesAvg || []
  const uniqueConditions = analytics.uniqueConditions || []

  return (
    <div className="analytics-dashboard">
      <h2>📊 Hunting Analytics Dashboard</h2>

      {/* Condition Filter */}
      <div className="analytics-filters">
        <label htmlFor="condition-filter">Filter by Condition:</label>
        <select
          id="condition-filter"
          value={selectedCondition}
          onChange={(e) => setSelectedCondition(e.target.value)}
          className="weather-filter-select"
        >
          <option value="all">All Conditions</option>
          {uniqueConditions.length > 0 ? (
            uniqueConditions.map(condition => (
              <option key={condition} value={condition}>{condition}</option>
            ))
          ) : (
            <option disabled>No condition data available</option>
          )}
        </select>
        {selectedCondition !== 'all' && (
          <span className="filter-indicator">
            Showing data for: <strong>{selectedCondition}</strong>
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalHunts}</div>
          <div className="stat-label">Total Hunts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalKills}</div>
          <div className="stat-label">Total Kills</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalMallards || 0}</div>
          <div className="stat-label">Total Mallards</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.uniqueBlinds}</div>
          <div className="stat-label">Blinds Used</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(stats.avgKillsPerMember)}</div>
          <div className="stat-label">Avg Kills/Member</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(stats.totalKillsPerHunt)}</div>
          <div className="stat-label">Total Kills/Hunt</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Top Members - Total */}
        <div className="chart-card">
          <h3>🏆 Top Performers (Total Kills)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMembers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#5a7c4a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Members - Average */}
        <div className="chart-card">
          <h3>⭐ Top Performers (Average per Hunt)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMembersAvg}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => value.toFixed(1)} />
              <Bar dataKey="average" fill="#6b8e5a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Species Breakdown */}
        <div className="chart-card">
          <h3>🦆 Species Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={topSpecies}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {topSpecies.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trends Over Time */}
        <div className="chart-card">
          <h3>📈 Kills Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dateTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke="#5a7c4a" fill="#5a7c4a" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Blinds - Total */}
        <div className="chart-card">
          <h3>🎯 Most Productive Blinds (Total)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topBlinds}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#8b6f47" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Blinds - Average */}
        <div className="chart-card">
          <h3>🎯 Most Productive Blinds (Average per Hunt)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topBlindsAvg}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => value.toFixed(1)} />
              <Bar dataKey="average" fill="#a0826d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Guides - Total */}
        {topGuides.length > 0 && (
          <div className="chart-card">
            <h3>👨‍🏫 Guide Performance (Total)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topGuides}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#7a9c6a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Guides - Average */}
        {topGuidesAvg.length > 0 && (
          <div className="chart-card">
            <h3>👨‍🏫 Guide Performance (Average per Hunt)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topGuidesAvg}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => value.toFixed(1)} />
                <Bar dataKey="average" fill="#9d7e5f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Member Performance Table */}
      <div className="table-card">
        <h3>📋 Detailed Member Performance</h3>
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                {topSpecies.slice(0, 8).map(species => (
                  <th key={species.name}>{species.name}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {topMembers.map(member => {
                const speciesData = analytics.memberSpeciesStats[member.name] || {}
                return (
                  <tr key={member.name}>
                    <td><strong>{member.name}</strong></td>
                    {topSpecies.slice(0, 8).map(species => (
                      <td key={species.name}>{speciesData[species.name] || 0}</td>
                    ))}
                    <td><strong>{member.total}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard

