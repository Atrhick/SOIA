'use client'

import * as React from 'react'
import { Check, ChevronDown, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

// Country data with flags, codes, and phone formats
const countries = [
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', format: '(###) ###-####', maxLength: 14 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', format: '(###) ###-####', maxLength: 14 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', format: '#### ### ####', maxLength: 13 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', format: '#### ### ###', maxLength: 12 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', format: '### ########', maxLength: 12 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##', maxLength: 14 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', format: '### ### ####', maxLength: 12 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', format: '### ### ###', maxLength: 11 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', format: '## ### ####', maxLength: 11 },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', format: '### ## ## ##', maxLength: 12 },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', format: '## ### ## ##', maxLength: 12 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', format: '### #######', maxLength: 11 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', format: '##-### ## ##', maxLength: 12 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', format: '### ## ###', maxLength: 10 },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', format: '## ## ## ##', maxLength: 11 },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', format: '## ### ####', maxLength: 11 },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', format: '## ### ####', maxLength: 11 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', format: '### ### ###', maxLength: 11 },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', format: '### ### ###', maxLength: 11 },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', format: '### ### ###', maxLength: 11 },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', format: '### ### ####', maxLength: 12 },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', format: '### ###-##-##', maxLength: 13 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', format: '##-####-####', maxLength: 13 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', format: '### #### ####', maxLength: 13 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', format: '##-####-####', maxLength: 13 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', format: '##### #####', maxLength: 11 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', format: '#### ####', maxLength: 9 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', format: '##-### ####', maxLength: 11 },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', format: '##-###-####', maxLength: 11 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', format: '###-###-####', maxLength: 12 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', format: '### ### ####', maxLength: 12 },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', format: '### ### ####', maxLength: 12 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', format: '## ### ####', maxLength: 11 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', format: '## ### ####', maxLength: 11 },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', format: '### ### ####', maxLength: 12 },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', format: '### ######', maxLength: 10 },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', format: '### ### ####', maxLength: 12 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', format: '## ### ####', maxLength: 11 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', format: '## ### ####', maxLength: 11 },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', format: '##-###-####', maxLength: 11 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', format: '### ### ####', maxLength: 12 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', format: '## #####-####', maxLength: 13 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', format: '### ### ####', maxLength: 12 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', format: '## ####-####', maxLength: 12 },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', format: '### ###-####', maxLength: 12 },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', format: '# #### ####', maxLength: 11 },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', format: '### ### ###', maxLength: 11 },
].sort((a, b) => a.name.localeCompare(b.name))

interface PhoneInputProps {
  value?: string
  countryCode?: string
  onChange?: (value: string, countryCode: string, fullNumber: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

function formatPhoneNumber(value: string, format: string): string {
  const digits = value.replace(/\D/g, '')
  let result = ''
  let digitIndex = 0

  for (let i = 0; i < format.length && digitIndex < digits.length; i++) {
    if (format[i] === '#') {
      result += digits[digitIndex]
      digitIndex++
    } else {
      result += format[i]
    }
  }

  return result
}

export function PhoneInput({
  value = '',
  countryCode = 'US',
  onChange,
  placeholder,
  disabled,
  className,
  id,
  name,
}: PhoneInputProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedCountry, setSelectedCountry] = React.useState(
    countries.find((c) => c.code === countryCode) || countries.find((c) => c.code === 'US')!
  )
  const [inputValue, setInputValue] = React.useState(value)
  const [search, setSearch] = React.useState('')
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const formatted = formatPhoneNumber(rawValue, selectedCountry.format)
    setInputValue(formatted)
    const fullNumber = `${selectedCountry.dialCode}${rawValue}`
    onChange?.(formatted, selectedCountry.code, fullNumber)
  }

  const handleCountrySelect = (country: typeof countries[0]) => {
    setSelectedCountry(country)
    setIsOpen(false)
    setSearch('')
    // Reformat existing value with new country format
    const digits = inputValue.replace(/\D/g, '')
    const formatted = formatPhoneNumber(digits, country.format)
    setInputValue(formatted)
    const fullNumber = `${country.dialCode}${digits}`
    onChange?.(formatted, country.code, fullNumber)
  }

  const filteredCountries = search
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : countries

  return (
    <div className={cn('relative flex', className)} ref={dropdownRef}>
      {/* Country Selector */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-3 py-2 border border-r-0 rounded-l-md bg-gray-50 hover:bg-gray-100 transition-colors',
          'border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-lg">{selectedCountry.flag}</span>
        <span className="text-sm text-gray-600">{selectedCountry.dialCode}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {/* Phone Input */}
      <div className="relative flex-1">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="tel"
          id={id}
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder || selectedCountry.format.replace(/#/g, '0')}
          disabled={disabled}
          maxLength={selectedCountry.maxLength}
          className={cn(
            'w-full pl-10 pr-3 py-2 border rounded-r-md',
            'border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'placeholder:text-gray-400',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
          )}
        />
      </div>

      {/* Country Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Country List */}
          <div className="overflow-y-auto max-h-60">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountrySelect(country)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left',
                  selectedCountry.code === country.code && 'bg-primary-50'
                )}
              >
                <span className="text-xl">{country.flag}</span>
                <span className="flex-1 text-sm">{country.name}</span>
                <span className="text-sm text-gray-500">{country.dialCode}</span>
                {selectedCountry.code === country.code && (
                  <Check className="h-4 w-4 text-primary-600" />
                )}
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500 text-center">No countries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
