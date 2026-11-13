/**
 * One-A-Day v2: the GENERAL messages (used when a program has no message of its own for a situation,
 * and for the main link) and the GENERAL tips shown under every program's "How to pitch" guide. PURE.
 *
 * Owned by the content writer. Every message here must pass scriptChecks() (scripts-defaults.test.ts),
 * which also fails on the banned words and phrases from the copy brief.
 * Wording: "sponsored seat", never "grant"; never promise a seat (the team decides on the call).
 *
 * Voice notes for anyone editing:
 * - Senders range from a 45-year-old coach to a 16-year-old ambassador texting an aunt. Plain, warm,
 *   no slang. Read it out loud as both before you save.
 * - Lead with the person ({personal line} right after the greeting, on its own line so it disappears
 *   cleanly when left empty), then ONE question. Vary the middle: not every message needs {intro}
 *   ("Have you come across {program}?" works too), and say the call differently each time.
 * - Texts mention the call in a few words and never describe it. An email describes it at most once,
 *   in its own words. "Three weeks" only in ASK_TIME. A parent is on the call for under-18s.
 * - Give a reason from the person ({personal line}), not generic praise ("you'd get a lot out of it").
 * - No throat-clearing ("I'll be honest", "here's the short version"), no stacked reassurance
 *   ("no pressure", "no strings"), no praise-the-question openers, no "you X, they Y, you decide" triads.
 * - Sponsorship only in ASK_PRICE, the PARENT email and ORG (the test checks).
 * - {intro} (introLine in scripts.ts) is "I run X, and one of our programs is Y, ..." for an owner,
 *   "My friend Z runs ..." for someone sharing a program, and "I'm part of NowTransformed, a youth leadership development program
 *   that helps people grow through small groups and coaching" for the main link. Never write
 *   "I run {business}" here, and nothing after {intro} may assume which of those it was.
 * - {program} is "NowTransformed" on the main link, so only use it where both read naturally.
 * - The free 30-minute call is run by the NowTransformed team, never the sender. Say so plainly.
 * - Sponsorship goes in [[sponsor: ...]] blocks (gone when there are no seats this month) and must
 *   leave the decision with the team: may, might, could, some, ask.
 * - Texts: no colons, semicolons or em dashes. Put {link} on its own line instead of "here: {link}".
 * - Everything except NEW and ORG must be fine for a 15-year-old ambassador to send to an adult they know.
 * - No two messages end with the same question (the test checks).
 */
import type { GeneralScripts, PlaybookSection } from './scripts'

export const GENERAL_SCRIPTS: GeneralScripts = {
  // ---------- first message ----------
  'KNOW:SHORT': {
    subject: null,
    body: "Hi {first name},\n{personal line}\nI keep thinking about you and {program}. It's what I've been busy with lately, and there's a free half-hour call if you want to see whether it fits.\nWant to hear more?",
  },
  'KNOW:EMAIL': {
    subject: "Thought of you, {first name}",
    body: "Hi {first name},\n\n{personal line}\n\n{intro}. I've been meaning to tell you about it.\n\nIt starts with a free half-hour call with the team, mostly so you can ask your questions and see whether it's for you.\n\nWant me to send you the details?\n\nThanks,\n{my name}",
  },
  'INTRO:SHORT': {
    subject: null,
    body: "Hi {first name}, I'm {my name}.\n{personal line}\n{intro}. There's a free half-hour call with the team to see what would fit you.\nWorth a chat?",
  },
  'INTRO:EMAIL': {
    subject: "Hello from {my name}",
    body: "Hi {first name},\n\nI'm {my name}. {personal line}\n\n{intro}.\n\nIf you're curious, there's a free 30-minute call with the team. If it looks like a fit, they'll talk through next steps with you, and it's fine to come with a list of questions.\n\nWould a short call be worth your time?\n\nThanks,\n{my name}",
  },
  'GROUP:SHORT': {
    subject: null,
    body: "Hi {first name}, it's {my name}.\n{personal line}\nWhen I think about who'd fit in at {program}, you're one of the first people who comes to mind. Have you heard of it?",
  },
  'GROUP:EMAIL': {
    subject: "From {my name}, in our group",
    body: "Hi {first name},\n\nIt's {my name}, from the group. {personal line}\n\n{intro}, and you came to mind.\n\nThe easiest way to find out more is a free half-hour call with the team. It's mostly a chance to say what you're after and see whether this is the right place for it.\n\nCould I send you the details?\n\n{my name}",
  },
  'NEW:SHORT': {
    subject: null,
    body: "Hi {first name}, I'm {my name}.\n{personal line}\n{intro}. If any of that is useful to you, there's a free half-hour call with the team.\nCan I tell you a bit more?",
  },
  'NEW:EMAIL': {
    subject: "Quick question from {my name}",
    body: "Hi {first name},\n\nI'm {my name}. {personal line}\n\n{intro}.\n\nI'm only asking whether you'd like to hear more. If you would, there's a free 30-minute call with the team at a time that suits you, to talk about what you're hoping for and whether this is the place for it.\n\nWould it be all right if I sent you a few details?\n\nThanks,\n{my name}",
  },
  'PARENT:SHORT': {
    subject: null,
    body: "Hi {first name},\n{personal line}\n{intro}. It starts with a half-hour call with the team, and for anyone under 18 a parent is on it, so you'd hear everything first.\nCould I tell you about it?",
  },
  'PARENT:EMAIL': {
    subject: "A thought for your family",
    body: "Hi {first name},\n\n{personal line}\n\n{intro}. I wanted to ask you first.\n\nIt starts with a free half-hour call with the team. For anyone under 18 a parent is on it, so you'd hear everything before anything is decided, and you can bring whatever questions you have. [[sponsor: If cost is a worry, you can ask them about a sponsored seat.]]\n\nWant me to send you the details so you can look first?\n\nThanks,\n{my name}",
  },
  'ORG:SHORT': {
    subject: null,
    body: "Hi {first name}, I'm {my name}. {intro}.\nI think some of the people you work with could use it. Each person books a free half-hour call with the NowTransformed team, so all you'd do is pass on a name. [[sponsor: They can ask about a sponsored seat on the call.]]\nCould I send you a short overview to share?",
  },
  'ORG:EMAIL': {
    subject: "For the people you work with",
    body: "Hi {first name},\n\nI'm {my name}. {intro}.\n\nI think some of the people you work with could use it, and a mention from you means more than anything I could post.\n\nIf you pass along a name, that person books a free half-hour call with the NowTransformed team, who get to know them and, if it's a fit, talk through next steps. [[sponsor: Where cost is a barrier, they can ask on the call about a sponsored seat.]]\n\nI can send a short overview you could forward, or come talk with your team for 15 minutes. Would either one help?\n\nThanks,\n{my name}",
  },
  'POST:POST': {
    subject: null,
    body: "{intro}.\n\nIf you've been wanting something like that for yourself, or you know someone who has, message me. There's a free half-hour call with the team to see whether it fits.\n\nOr book a call here\n{link}",
  },
  // ---------- when they reply ----------
  'YES:SHORT': {
    subject: null,
    body: "Great. Here's where you sign up and pick a time\n{link}\nIf you jot down a couple of questions first, the team will go through them with you.",
  },
  'ASK_PRICE:SHORT': {
    subject: null,
    body: "The call is free. The team goes over cost on the call, so you hear it from them and not my guess. [[sponsor: You can also ask them about a sponsored seat.]]\nWant the link to book it?",
  },
  'ASK_TIME:SHORT': {
    subject: null,
    body: "It's only half an hour, and you can book it up to three weeks out, so pick whichever week is calmer. Nothing to decide until after.\nWant me to send it so you can look at the times?",
  },
  'ASK_TEEN:SHORT': {
    subject: null,
    body: "Pretty normal at that age. They don't have to be sold on it before the call. A parent is always on it for anyone under 18, so you'd be there, and they can ask their own questions.\nWould they try one call with you there?",
  },
  'ASK_LEGIT:SHORT': {
    subject: null,
    body: "Good that you checked. NowTransformed is a youth leadership development program, and I'm part of it. The call is with the people who run it. This page shows who invited you and how it works\n{link}\nAsk me anything else.",
  },
  'ASK_INFO:SHORT': {
    subject: null,
    body: "Sure. Everything's on this page\n{link}\nMind if I check in later this week?",
  },
  // ---------- following up ----------
  'FOLLOW_UP:SHORT': {
    subject: null,
    body: "Hi {first name}, bumping this in case it got buried. The call's only half an hour, at whatever time suits you.\nStill curious, or not right now?",
  },
  'LAST:SHORT': {
    subject: null,
    body: "Hi {first name}, I'll leave this with you. If you want to talk about {program} later, I'm easy to find.",
  },
  'NO_CALL:SHORT': {
    subject: null,
    body: "Hi {first name}, thanks for signing up. Your call isn't booked yet, and that email with the booking link is easy to lose. Put your email in here and you'll get a fresh one\n{link}\nIf none of the times work, tell me and I'll ask the team.",
  },
  'THANKS:SHORT': {
    subject: null,
    body: "Hi {first name}, I'm really glad you said yes. Let me know how it goes.",
  },
}

/** Tips for everyone, shown under every program's guide (and as the guide for the main link). */
export const GENERAL_TIPS: PlaybookSection[] = [
  {
    title: "If \"selling\" feels weird",
    points: [
      "You're not selling anything. You're asking one person if they want a 30-minute conversation with the NowTransformed team, and \"no\" is a perfectly good answer.",
      "Think of it like telling someone about a good dentist or a show you liked. You thought of them, so you mentioned it. That's all a first message has to be.",
      "Plenty of people won't reply to the first message, and it's almost never about you. They were busy, the text got buried, or the timing is off.",
      "If you're 17 or under, only message adults you already know, like family, family friends or a teacher you trust. If the person who could use this is under 18, talk to their parent, never to them directly.",
    ],
  },
  {
    title: "Who to message first",
    points: [
      "Start with people who'd pick up if you called. Write down five names before you write a single message, because a list is easier than a blank screen.",
      "Listen for things people have already said. \"I need to get out of the house more\", \"My son has no idea what he wants to do after school\" or \"I wish I could give back somehow\" are all openings.",
      "Your main link works for helpers too, not only for people who want help. The friend who always organizes the food drive might want to volunteer, sponsor or coach.",
      "One connector beats ten strangers. A youth pastor, a teacher, a coach or a caseworker knows dozens of people, and one good conversation with them can matter more than a week of messages.",
    ],
  },
  {
    title: "Writing it",
    points: [
      "Your personal line does most of the work. \"You said the new job has you wiped out\" gets a reply, and \"Hope you're well\" doesn't. If you can't think of a real line for someone, pick someone else today.",
      "Read the message out loud before you send it. If you wouldn't say it that way at the kitchen table, change the words until you would.",
      "Ask one question and stop. \"Any interest?\" is easier to answer than a long message that ends with three questions, and it already sounds relaxed without a line of reassurance in front of it.",
      "If they ask what the call is like, tell them plainly. The team gets to know them and, if it's a fit, talks through next steps, and they're welcome to bring a list of questions.",
      "Leave out the link and the price in a first message. You're asking for a reply, and a link makes it feel like an ad.",
    ],
  },
  {
    title: "When they reply",
    points: [
      "If they say yes, send the link the same day while it's fresh, then tap \"I sent it\" so the app reminds you to follow up.",
      "If they ask what it costs, don't guess. Try \"Honestly, I don't want to get it wrong, and that's exactly what the free call is for\" and offer the link.",
      "If they ask \"so what is it exactly?\", answer in one sentence in your own words and say why you thought of them. A wall of text loses people.",
      "If they say \"maybe later\", believe them. Say \"No problem, I'll check back next month\", and then actually do it.",
      "If someone says no or asks you to stop, thank them and let it go for good. Mark them \"Said no\" in your follow-ups so the app stops reminding you.",
    ],
  },
  {
    title: "Following up and staying honest",
    points: [
      "Follow up twice at most. Send one check-in after 3 or 4 days with something new, one kind last note around day 10 to 14, and then stop.",
      "Never send \"Did you see my message?\" because it makes people feel guilty. Give them something new instead, like the fact that the call is only half an hour.",
      "Never say someone will get a sponsored seat. Say they may be able to and can ask on the call, because the team decides.",
      "Don't promise results, health changes or money. Say what happens next (a free call), not what it will do for them.",
      "Never name, tag or post about anyone under 18, and never mention anyone's health, money or foster care situation in public.",
    ],
  },
]
