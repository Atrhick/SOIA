// Simple event emitter for calendar updates
// In production, you'd use Redis pub/sub or similar for multi-process support

type CalendarEventListener = (data: { type: string; payload?: unknown }) => void

class CalendarEventEmitter {
  private listeners = new Map<string, Set<CalendarEventListener>>()

  subscribe(calendarId: string, listener: CalendarEventListener): () => void {
    if (!this.listeners.has(calendarId)) {
      this.listeners.set(calendarId, new Set())
    }
    this.listeners.get(calendarId)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(calendarId)?.delete(listener)
      if (this.listeners.get(calendarId)?.size === 0) {
        this.listeners.delete(calendarId)
      }
    }
  }

  emit(calendarId: string, data: { type: string; payload?: unknown }) {
    const calendarListeners = this.listeners.get(calendarId)
    if (calendarListeners) {
      calendarListeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          console.error('Error in calendar event listener:', error)
        }
      })
    }
  }

  // Broadcast to all calendars (useful for global updates)
  broadcast(data: { type: string; payload?: unknown }) {
    this.listeners.forEach((listeners, calendarId) => {
      this.emit(calendarId, data)
    })
  }
}

// Singleton instance - persists across hot reloads in development
const globalForCalendarEvents = globalThis as unknown as {
  calendarEvents: CalendarEventEmitter | undefined
}

export const calendarEvents = globalForCalendarEvents.calendarEvents ?? new CalendarEventEmitter()

if (process.env.NODE_ENV !== 'production') {
  globalForCalendarEvents.calendarEvents = calendarEvents
}
