/**
 * Time zones offered in pickers (hosts and prospects), grouped by world region.
 * Any valid IANA zone is still accepted by the server; this list is only what the pickers show,
 * and a detected zone that is not listed is added on top by `zoneOptions`.
 */
export const TIME_ZONE_GROUPS: { region: string; zones: { id: string; city: string }[] }[] = [
  {
    region: 'Africa',
    zones: [
      { id: 'Africa/Nairobi', city: 'Nairobi, Kampala, Addis Ababa, Dar es Salaam' },
      { id: 'Africa/Johannesburg', city: 'Johannesburg, Harare, Lusaka, Maputo' },
      { id: 'Africa/Kigali', city: 'Kigali, Bujumbura, Lilongwe' },
      { id: 'Africa/Lagos', city: 'Lagos, Kinshasa, Luanda, Douala' },
      { id: 'Africa/Accra', city: 'Accra, Dakar, Abidjan' },
      { id: 'Africa/Cairo', city: 'Cairo' },
      { id: 'Africa/Casablanca', city: 'Casablanca' },
    ],
  },
  {
    region: 'Americas',
    zones: [
      { id: 'America/New_York', city: 'Eastern Time (New York, Atlanta, Toronto)' },
      { id: 'America/Chicago', city: 'Central Time (Chicago, Dallas, Houston)' },
      { id: 'America/Denver', city: 'Mountain Time (Denver)' },
      { id: 'America/Phoenix', city: 'Arizona (Phoenix)' },
      { id: 'America/Los_Angeles', city: 'Pacific Time (Los Angeles, Seattle)' },
      { id: 'America/Anchorage', city: 'Alaska' },
      { id: 'Pacific/Honolulu', city: 'Hawaii' },
      { id: 'America/Puerto_Rico', city: 'Puerto Rico, Eastern Caribbean' },
      { id: 'America/Jamaica', city: 'Jamaica' },
      { id: 'America/Mexico_City', city: 'Mexico City' },
      { id: 'America/Bogota', city: 'Bogotá, Lima, Quito' },
      { id: 'America/Sao_Paulo', city: 'São Paulo, Rio de Janeiro' },
      { id: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
    ],
  },
  {
    region: 'Europe',
    zones: [
      { id: 'Europe/London', city: 'London, Dublin, Lisbon' },
      { id: 'Europe/Paris', city: 'Paris, Berlin, Madrid, Rome, Amsterdam' },
      { id: 'Europe/Athens', city: 'Athens, Bucharest, Kyiv' },
      { id: 'Europe/Istanbul', city: 'Istanbul' },
      { id: 'Europe/Moscow', city: 'Moscow' },
    ],
  },
  {
    region: 'Middle East',
    zones: [
      { id: 'Asia/Jerusalem', city: 'Jerusalem' },
      { id: 'Asia/Riyadh', city: 'Riyadh, Kuwait, Doha' },
      { id: 'Asia/Dubai', city: 'Dubai, Abu Dhabi, Muscat' },
    ],
  },
  {
    region: 'Asia',
    zones: [
      { id: 'Asia/Karachi', city: 'Karachi, Islamabad' },
      { id: 'Asia/Kolkata', city: 'India (Mumbai, Delhi)' },
      { id: 'Asia/Dhaka', city: 'Dhaka' },
      { id: 'Asia/Bangkok', city: 'Bangkok, Jakarta, Ho Chi Minh City' },
      { id: 'Asia/Singapore', city: 'Singapore, Kuala Lumpur' },
      { id: 'Asia/Manila', city: 'Manila' },
      { id: 'Asia/Shanghai', city: 'China (Beijing, Shanghai), Hong Kong' },
      { id: 'Asia/Seoul', city: 'Seoul' },
      { id: 'Asia/Tokyo', city: 'Tokyo' },
    ],
  },
  {
    region: 'Oceania',
    zones: [
      { id: 'Australia/Perth', city: 'Perth' },
      { id: 'Australia/Sydney', city: 'Sydney, Melbourne' },
      { id: 'Pacific/Auckland', city: 'Auckland' },
      { id: 'Pacific/Fiji', city: 'Fiji' },
    ],
  },
]

export const LISTED_ZONES = new Set(TIME_ZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.id)))

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** "GMT+3" style offset for a zone at a given moment (changes with daylight saving). */
export function zoneOffset(tz: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')
    return part?.value === 'GMT' ? 'GMT+0' : part?.value ?? ''
  } catch { return '' }
}

/** Readable name for a zone id that may not be in the list ("America/Port_of_Spain" -> "Port of Spain"). */
export function zoneLabel(tz: string): string {
  for (const g of TIME_ZONE_GROUPS) for (const z of g.zones) if (z.id === tz) return z.city
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
}

/** Picker groups, with the current/detected zone added on top when it is not already listed. */
export function zoneOptions(current?: string | null) {
  const groups = TIME_ZONE_GROUPS.map((g) => ({ region: g.region, zones: g.zones.map((z) => ({ id: z.id, label: z.city })) }))
  if (current && !LISTED_ZONES.has(current) && isValidTimeZone(current)) {
    groups.unshift({ region: 'Your time zone', zones: [{ id: current, label: zoneLabel(current) }] })
  }
  return groups
}

/** Admins who are not hosts see staff screens in Central Time. */
export const STAFF_DEFAULT_TZ = 'America/Chicago'
