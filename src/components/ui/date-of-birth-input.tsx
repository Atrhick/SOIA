'use client'

import * as React from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateOfBirthInputProps {
  value?: string // ISO date string (YYYY-MM-DD)
  onChange?: (value: string) => void
  minAge?: number
  maxAge?: number
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function DateOfBirthInput({
  value,
  onChange,
  minAge = 0,
  maxAge = 120,
  disabled,
  className,
  id,
  name,
}: DateOfBirthInputProps) {
  const currentYear = new Date().getFullYear()
  const minYear = currentYear - maxAge
  const maxYear = currentYear - minAge

  // Generate year options (most recent first for easier selection)
  const years = React.useMemo(() => {
    const yearList = []
    for (let year = maxYear; year >= minYear; year--) {
      yearList.push(year)
    }
    return yearList
  }, [minYear, maxYear])

  // Parse existing value
  const [selectedYear, setSelectedYear] = React.useState<string>('')
  const [selectedMonth, setSelectedMonth] = React.useState<string>('')
  const [selectedDay, setSelectedDay] = React.useState<string>('')

  React.useEffect(() => {
    if (value) {
      const [year, month, day] = value.split('-')
      setSelectedYear(year || '')
      setSelectedMonth(month || '')
      setSelectedDay(day || '')
    }
  }, [value])

  // Get days for selected month/year
  const days = React.useMemo(() => {
    if (!selectedYear || !selectedMonth) return Array.from({ length: 31 }, (_, i) => i + 1)
    const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth))
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [selectedYear, selectedMonth])

  // Update value when any part changes
  const handleChange = (type: 'year' | 'month' | 'day', newValue: string) => {
    let year = selectedYear
    let month = selectedMonth
    let day = selectedDay

    if (type === 'year') {
      year = newValue
      setSelectedYear(newValue)
    } else if (type === 'month') {
      month = newValue
      setSelectedMonth(newValue)
      // Adjust day if needed
      if (year && day) {
        const maxDays = getDaysInMonth(parseInt(year), parseInt(newValue))
        if (parseInt(day) > maxDays) {
          day = maxDays.toString().padStart(2, '0')
          setSelectedDay(day)
        }
      }
    } else {
      day = newValue
      setSelectedDay(newValue)
    }

    // Only emit full date when all parts are selected
    if (year && month && day) {
      const formattedDate = `${year}-${month}-${day.padStart(2, '0')}`
      onChange?.(formattedDate)
    }
  }

  const selectClassName = cn(
    'px-3 py-2 border rounded-md appearance-none cursor-pointer',
    'border-gray-300 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
  )

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />

        {/* Month Selector */}
        <div className="relative flex-1">
          <select
            value={selectedMonth}
            onChange={(e) => handleChange('month', e.target.value)}
            disabled={disabled}
            className={cn(selectClassName, 'w-full pr-8')}
            aria-label="Month"
          >
            <option value="">Month</option>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Day Selector */}
        <div className="relative w-20">
          <select
            value={selectedDay}
            onChange={(e) => handleChange('day', e.target.value)}
            disabled={disabled}
            className={cn(selectClassName, 'w-full pr-8')}
            aria-label="Day"
          >
            <option value="">Day</option>
            {days.map((day) => (
              <option key={day} value={day.toString().padStart(2, '0')}>
                {day}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Year Selector - Made prominent */}
        <div className="relative w-28">
          <select
            value={selectedYear}
            onChange={(e) => handleChange('year', e.target.value)}
            disabled={disabled}
            className={cn(selectClassName, 'w-full pr-8 font-medium')}
            aria-label="Year"
          >
            <option value="">Year</option>
            {years.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Hidden input for form submission */}
      {id && (
        <input
          type="hidden"
          id={id}
          name={name || id}
          value={selectedYear && selectedMonth && selectedDay
            ? `${selectedYear}-${selectedMonth}-${selectedDay.padStart(2, '0')}`
            : ''}
        />
      )}

      {/* Age indicator */}
      {selectedYear && selectedMonth && selectedDay && (
        <p className="text-xs text-gray-500">
          Age: {calculateAge(selectedYear, selectedMonth, selectedDay)} years old
        </p>
      )}
    </div>
  )
}

function calculateAge(year: string, month: string, day: string): number {
  const today = new Date()
  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}
