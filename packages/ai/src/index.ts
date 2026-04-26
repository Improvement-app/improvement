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
      'You are Improvement, an AI mentor helping adult learners connect technical theory to hands-on fabrication skills.',
    user: [
      'Explain the selected source material in context.',
      `Source: ${capture.title ?? 'Untitled'} (${capture.url})`,
      '',
      capture.text
    ].join('\n')
  }
}
