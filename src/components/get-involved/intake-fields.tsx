'use client'

import { useState } from 'react'
import { AGE_RANGES, AgeRangeValue } from '@/lib/get-involved/core'
import { PhoneField } from '@/components/get-involved/signup/phone-field'

const input = 'w-full h-11 rounded-lg border border-gray-300 px-3 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const label = 'block text-sm font-semibold text-gray-700 mb-1.5'

/**
 * Name, email, phone (with country code; required for 18 and over), city, age range, and parent fields for 17 and under.
 * Field names match intakeSchema in src/lib/actions/get-involved.ts.
 * `forInviter` changes the wording for a coach or ambassador adding someone.
 */
export function IntakeFields({ forInviter = false }: { forInviter?: boolean }) {
  const [age, setAge] = useState<AgeRangeValue | ''>('')
  const minor = age === 'UNDER_18'
  return (
    <div className="space-y-4">
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="gi-fn">First name</label><input id="gi-fn" name="firstName" required maxLength={60} autoComplete="given-name" className={input} /></div>
        <div><label className={label} htmlFor="gi-ln">Last name</label><input id="gi-ln" name="lastName" required maxLength={60} autoComplete="family-name" className={input} /></div>
        <div><label className={label} htmlFor="gi-em">Email</label><input id="gi-em" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="name@example.com" className={input} /></div>
        <div><label className={label} htmlFor="gi-ph">Mobile number{minor ? ' (optional)' : ''}</label><PhoneField id="gi-ph" className="h-11 [&_input]:h-11 [&>button]:h-11" /></div>
      </div>
      <div><label className={label} htmlFor="gi-city">City and state / country</label><input id="gi-city" name="city" maxLength={100} placeholder="e.g. Atlanta, GA" className={input} /></div>

      <fieldset className="min-w-0">
        <legend className={label}>Age range</legend>
        <input type="hidden" name="ageRange" value={age} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup">
          {AGE_RANGES.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={age === a.value}
              onClick={() => setAge(a.value)}
              className={`h-12 rounded-lg border text-[15px] ${age === a.value ? 'border-2 border-primary-700 bg-primary-100 text-primary-800 font-semibold' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-600">17 and under: we ask a parent or guardian for consent first, and a parent or guardian must be on the discovery call.</p>
      </fieldset>

      {minor && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-800">Parent or guardian</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="gi-pn">Their full name</label><input id="gi-pn" name="parentName" required maxLength={120} className={input} /></div>
            <div><label className={label} htmlFor="gi-pe">Their email</label><input id="gi-pe" name="parentEmail" type="email" required maxLength={200} placeholder="name@example.com" className={input} /></div>
            <div><label className={label} htmlFor="gi-pp">Their phone (optional)</label><input id="gi-pp" name="parentPhone" type="tel" maxLength={40} className={input} /></div>
          </div>
        </div>
      )}

      {forInviter && (
        <div><label className={label} htmlFor="gi-note">Note for the interviewer (optional)</label><textarea id="gi-note" name="note" maxLength={1000} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Where you met, what they're interested in" /></div>
      )}

      <label className="flex gap-2.5 items-start text-sm text-gray-700">
        <input type="checkbox" name="consent" required className="mt-0.5 h-[18px] w-[18px] accent-primary-700" />
        {forInviter ? 'They said it\'s okay for NowTransformed to email and text them.' : 'I agree to be contacted by email and text about NowTransformed.'}
      </label>
    </div>
  )
}
