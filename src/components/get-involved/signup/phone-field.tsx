'use client'

import { useState } from 'react'
import { PhoneInput } from '@/components/ui/phone-input'

/**
 * PhoneInput (country code picker) wired into a plain <form>: posts `phone` as "+1 (702) 555-0123"
 * (dial code + national number, empty when nothing typed) and `phoneCountryCode` (ISO, e.g. "US").
 */
export function PhoneField({ id, className }: { id: string; className?: string }) {
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('US')
  return (
    <>
      <PhoneInput
        id={id}
        countryCode="US"
        className={className}
        onChange={(formatted, code, full) => {
          const digits = formatted.replace(/\D/g, '')
          const dial = full.slice(0, full.length - digits.length)
          setCountry(code)
          setPhone(digits ? `${dial} ${formatted}` : '')
        }}
      />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="phoneCountryCode" value={country} />
    </>
  )
}
