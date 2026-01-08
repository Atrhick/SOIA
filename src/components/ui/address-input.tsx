'use client'

import * as React from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Country list with codes
const countries = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'GR', name: 'Greece' },
  { code: 'RU', name: 'Russia' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'TR', name: 'Turkey' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' },
].sort((a, b) => a.name.localeCompare(b.name))

// US States
const usStates = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
]

// Canadian Provinces
const canadianProvinces = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
]

export interface AddressData {
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
  country: string
}

interface AddressInputProps {
  value?: Partial<AddressData>
  onChange?: (value: AddressData) => void
  disabled?: boolean
  className?: string
  required?: boolean
  namePrefix?: string
}

export function AddressInput({
  value = {},
  onChange,
  disabled,
  className,
  required,
  namePrefix = '',
}: AddressInputProps) {
  const [address, setAddress] = React.useState<AddressData>({
    address1: value.address1 || '',
    address2: value.address2 || '',
    city: value.city || '',
    state: value.state || '',
    postalCode: value.postalCode || '',
    country: value.country || 'US',
  })

  const handleChange = (field: keyof AddressData, newValue: string) => {
    const updated = { ...address, [field]: newValue }

    // Clear state when country changes
    if (field === 'country' && newValue !== address.country) {
      updated.state = ''
    }

    setAddress(updated)
    onChange?.(updated)
  }

  // Get state/province options based on country
  const stateOptions = React.useMemo(() => {
    if (address.country === 'US') return usStates
    if (address.country === 'CA') return canadianProvinces
    return null
  }, [address.country])

  const stateLabel = address.country === 'CA' ? 'Province' : 'State/Province'
  const postalLabel = address.country === 'US' ? 'ZIP Code' : 'Postal Code'

  const inputClassName = cn(
    'w-full px-3 py-2 border rounded-md',
    'border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    'placeholder:text-gray-400',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
  )

  const selectClassName = cn(
    'w-full px-3 py-2 border rounded-md appearance-none cursor-pointer',
    'border-gray-300 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
  )

  const getName = (field: string) => namePrefix ? `${namePrefix}${field}` : field

  return (
    <div className={cn('space-y-3', className)}>
      {/* Address Line 1 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 1 {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            name={getName('address1')}
            value={address.address1}
            onChange={(e) => handleChange('address1', e.target.value)}
            placeholder="Street address, P.O. box"
            disabled={disabled}
            required={required}
            className={cn(inputClassName, 'pl-10')}
          />
        </div>
      </div>

      {/* Address Line 2 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 2
        </label>
        <input
          type="text"
          name={getName('address2')}
          value={address.address2}
          onChange={(e) => handleChange('address2', e.target.value)}
          placeholder="Apartment, suite, unit, building, floor, etc."
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      {/* City and State/Province */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            name={getName('city')}
            value={address.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="City"
            disabled={disabled}
            required={required}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {stateLabel} {required && <span className="text-red-500">*</span>}
          </label>
          {stateOptions ? (
            <div className="relative">
              <select
                name={getName('state')}
                value={address.state}
                onChange={(e) => handleChange('state', e.target.value)}
                disabled={disabled}
                required={required}
                className={selectClassName}
              >
                <option value="">Select {stateLabel}</option>
                {stateOptions.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              name={getName('state')}
              value={address.state}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder={stateLabel}
              disabled={disabled}
              className={inputClassName}
            />
          )}
        </div>
      </div>

      {/* Postal Code and Country */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {postalLabel} {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            name={getName('postalCode')}
            value={address.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder={address.country === 'US' ? '12345' : 'Postal code'}
            disabled={disabled}
            required={required}
            className={inputClassName}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <select
              name={getName('country')}
              value={address.country}
              onChange={(e) => handleChange('country', e.target.value)}
              disabled={disabled}
              required={required}
              className={selectClassName}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
