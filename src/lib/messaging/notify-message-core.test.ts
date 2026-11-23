import { describe, expect, it } from 'vitest'
import { messagePreview, messagesPathFor, unreadMessagesEmail } from './notify-message-core'

describe('message notices', () => {
  it('links each role to its own messages page', () => {
    expect(messagesPathFor('ADMIN')).toBe('/admin/collaboration/messages')
    expect(messagesPathFor('COACH')).toBe('/coach/collaboration/messages')
    expect(messagesPathFor('AMBASSADOR')).toBe('/ambassador/collaboration/messages')
    expect(messagesPathFor('PARENT')).toBe('/parent/messages')
    expect(messagesPathFor('VOLUNTEER')).toBe('/')
  })

  it('shows mentions as names and shortens long messages', () => {
    expect(messagePreview('Hi @[Lina Lopez](user:abc)\n\nsee this')).toBe('Hi @Lina Lopez see this')
    const long = messagePreview('word '.repeat(100))
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('…')).toBe(true)
  })

  it('writes one email for one conversation, and a list for several', () => {
    const one = unreadMessagesEmail({ first: 'Criztal', items: [{ title: 'New message from Lina Lopez', preview: 'Can you <b>check</b> this?' }], openUrl: 'https://x/admin/collaboration/messages' })
    expect(one.subject).toBe('Unread message from Lina Lopez')
    expect(one.html).toContain('Hi Criztal')
    expect(one.html).toContain('&lt;b&gt;check&lt;/b&gt;') // escaped
    expect(one.html).toContain('Open the message')
    expect(one.html).toContain('To stop these emails')
    const items = Array.from({ length: 7 }, (_, i) => ({ title: `New message from Person ${i}`, preview: 'hi' }))
    const many = unreadMessagesEmail({ first: 'Vicky', items, openUrl: 'https://x' })
    expect(many.subject).toBe('You have unread messages in 7 conversations')
    expect(many.html).toContain('Person 4')
    expect(many.html).not.toContain('Person 5')
    expect(many.html).toContain('And 2 more.')
  })
})
