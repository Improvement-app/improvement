export interface LearningCapture {
  text: string
  url: string
  title?: string
}

export interface MentorPrompt {
  system: string
  user: string
}

export function buildMentorPrompt(capture: LearningCapture): MentorPrompt {
  return {
    system:
      'You are Improvement, an AI mentor helping adult learners connect technical theory to hands-on fabrication skills. Be direct, technically careful, and practical.',
    user: [
      'The learner selected this source material during a technical learning session. Explain it in context and connect it to engineering theory, design decisions, or fabrication practice when useful.',
      `Source: ${capture.title ?? 'Untitled'} (${capture.url})`,
      '',
      capture.text
    ].join('\n')
  }
}
