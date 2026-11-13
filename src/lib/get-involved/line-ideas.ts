/**
 * Ideas for the "why you thought of them" line ({personal line}). Members tap one, it goes into the box,
 * and they make it their own; a [bracket] left in blocks sending (hasBlank in scripts.ts).
 * Program ideas live in ProgramPlaybook guides (lineIdeas); these are for the main link and for any
 * program or scenario without its own. Client-safe: no server imports.
 */
import type { LineIdea, LineIdeas } from './scripts'

// Written by copywriters and checked by a critic (2026-11-12). Teen-friendly ideas say so in "when".
export const GENERAL_LINE_IDEAS: LineIdeas = {
  "KNOW": [
    {
      "when": "They said they feel stuck lately",
      "line": "You said a while back that you've been feeling a bit stuck."
    },
    {
      "when": "Their kid starts high school next year",
      "line": "[Kid's name] starts high school next year, and you said you wanted them to have something besides school."
    },
    {
      "when": "They want to give back somehow",
      "line": "You told me you've been wanting to give back somehow."
    },
    {
      "when": "You wanted them to hear it first",
      "line": "You're one of the first people I wanted to tell about this."
    },
    {
      "when": "Big change in their year",
      "line": "It's been a big year for you with [their big change, like the new job]."
    },
    {
      "when": "They just retired",
      "line": "You said you've got more time now that you've retired."
    },
    {
      "when": "Teen to an aunt, uncle or grandparent",
      "line": "You always ask what I've been up to after school."
    },
    {
      "when": "Teen to a family friend about their kid",
      "line": "You were asking about things for [their kid's name] to do after school, so I wanted you to know about this."
    }
  ],
  "INTRO": [
    {
      "when": "A friend passed on their number",
      "line": "[Friend's name] gave me your number and said you'd want to hear about this."
    },
    {
      "when": "Introduced at an event",
      "line": "[Name] introduced us at [event] and said you've been looking for something for your teenager."
    },
    {
      "when": "They already mentor young people",
      "line": "[Name] said you've mentored young people for years and might want to do more of it."
    },
    {
      "when": "They just moved to the area",
      "line": "[Name] mentioned you just moved here and are still getting to know people."
    },
    {
      "when": "They asked a friend about youth programs",
      "line": "[Name] told me you'd asked about programs for young people, so I said I'd write."
    },
    {
      "when": "Teen, introduced by their parent",
      "line": "My mom, [her name], said you'd be a good person to tell about this."
    },
    {
      "when": "Teen, introduced by a teacher or coach",
      "line": "Coach [name] said you know a lot of families and told me to message you."
    },
    {
      "when": "Teen, introduced by a friend their age",
      "line": "[Friend's name] said you're the one to ask about stuff for teens."
    }
  ],
  "GROUP": [
    {
      "when": "They asked a question in the group",
      "line": "I saw your question in [group name] about things for teens to do this summer."
    },
    {
      "when": "They organize everything in the group",
      "line": "You're always the one organizing things at [group]."
    },
    {
      "when": "They posted about trying something new",
      "line": "You posted in [group name] about wanting to try something new this year."
    },
    {
      "when": "Your kids go to the same school",
      "line": "Our kids are both at [school name], so I figured I'd say hi properly."
    },
    {
      "when": "They want to do more for young people",
      "line": "At [meeting or event] you said you'd like to do more for the young people around here."
    },
    {
      "when": "A coworker you know a little",
      "line": "We work together at [workplace], but we've barely had a chance to talk."
    },
    {
      "when": "Teen to an adult from church or a club",
      "line": "I'm in the youth group at [church or club], and you've always been easy to talk to."
    },
    {
      "when": "Teen to a parent from school or a team",
      "line": "I know [their kid's name] from [school or team], and I've seen you at a lot of our games."
    }
  ],
  "NEW": [
    {
      "when": "You saw their post in a local group",
      "line": "I saw your post in [group or page] asking about things for teens around here."
    },
    {
      "when": "Someone named them as a helper",
      "line": "Your name came up when I asked who helps young people in [town]."
    },
    {
      "when": "You heard them speak",
      "line": "I heard you speak at [event] about [topic], and I wrote your name down afterward."
    },
    {
      "when": "Their business hires young people",
      "line": "I noticed [business name] hires a lot of high school and college students."
    },
    {
      "when": "Something they wrote online stuck",
      "line": "I read what you wrote about [topic], and it stuck with me."
    },
    {
      "when": "They lead a team, club or group",
      "line": "You lead [team, club or group], so I figured you'd know families who'd want to hear about this."
    },
    {
      "when": "They work at a school",
      "line": "I saw you run [club or program] at [school]."
    }
  ],
  "PARENT": [
    {
      "when": "Their teen is starting high school",
      "line": "With [teen's name] starting high school, it's a big year at your house."
    },
    {
      "when": "Teen is still working out what's next",
      "line": "You mentioned [teen's name] is still figuring out what comes after graduation."
    },
    {
      "when": "You saw the teen shine at something",
      "line": "[Teen's name] was so good with the younger kids at [event]."
    },
    {
      "when": "They want something outside school",
      "line": "You were saying [teen's name] could use something of their own outside school."
    },
    {
      "when": "Your own kid is in it",
      "line": "My own [son or daughter] has been doing this since [month], so I wanted you to hear about it from me."
    },
    {
      "when": "Teen is quiet but thoughtful",
      "line": "[Teen's name] doesn't say much, but when they do, it's worth hearing."
    },
    {
      "when": "Teen to a friend's parent",
      "line": "I've been doing this for a while, and I think [friend's name] would like it too."
    },
    {
      "when": "Teen to an aunt or uncle about a cousin",
      "line": "I think [cousin's name] would like the thing I've been doing, so I'm asking you first."
    }
  ]
}

/** Ideas for one scenario: the program's own, else the general ones, else the general "someone I know". */
export function ideasFor(scenario: string | null | undefined, programIdeas?: LineIdeas | null): LineIdea[] {
  const key = scenario ?? 'KNOW'
  return programIdeas?.[key]?.length ? programIdeas[key]! : GENERAL_LINE_IDEAS[key]?.length ? GENERAL_LINE_IDEAS[key]! : GENERAL_LINE_IDEAS.KNOW ?? []
}

const BANNED = /\b(journey|unlock|empower\w*|game[- ]changer|transform your life|nonprofit|non-profit|hope this (email )?finds you|reach out|programme)\b/i
// Things nobody should put in writing about someone else, however well meant.
const SENSITIVE = /\b(diagnos\w*|depress\w*|anxiety|debt|bankrupt\w*|divorc\w*|custody|court|abuse\w*|arrest\w*|rehab|addict\w*|suicid\w*)\b/i

/** Problems with one idea (empty = fine). Used by the content validator and the tests. */
export function lineIdeaProblems(i: LineIdea): string[] {
  const out: string[] = []
  const when = i.when.trim()
  const line = i.line.trim()
  if (when.length < 3 || when.length > 60) out.push('"when" should be 3-60 characters')
  if (!line) out.push('empty line')
  if (line.length > 200) out.push('line longer than 200 characters (the box limit)')
  if ((line.match(/\[[^\]]*\]/g) ?? []).length > 2) out.push('more than 2 [brackets]')
  if (/[\u2013\u2014]/.test(line)) out.push('dash')
  if (/!{2,}|[\uD83C-\uD83E][\uDC00-\uDFFF]/.test(line)) out.push('exclamation spam or emoji')
  if (BANNED.test(line) || BANNED.test(when)) out.push('banned phrase')
  if (SENSITIVE.test(line)) out.push('sensitive subject')
  if (/[{}]/.test(line)) out.push('fill-in braces')
  return out
}
