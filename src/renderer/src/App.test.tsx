import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { CapturedSelection, MentorStreamEvent, RendererApi, TabsSnapshot, TranscriptCaptureEvent } from '../../shared/ipc'
import type { CapturedResource } from '../../shared/resources'

const tabsSnapshot: TabsSnapshot = {
  activeTabId: 'tab-1',
  tabs: [
    {
      id: 'tab-1',
      title: 'Suspension Geometry',
      url: 'https://example.com/suspension',
      isLoading: false,
      canGoBack: false,
      canGoForward: true
    },
    {
      id: 'tab-2',
      title: 'Welding Basics',
      url: 'https://example.com/welding',
      isLoading: false,
      canGoBack: true,
      canGoForward: false
    }
  ]
}

interface ImprovementMock {
  api: RendererApi
  emitTabsChanged: (snapshot: TabsSnapshot) => void
  emitSelectionCaptured: (selection: CapturedSelection) => void
  emitTranscriptCapture: (event: TranscriptCaptureEvent) => void
  emitMentorStream: (event: MentorStreamEvent) => void
}

function installImprovementMock(initialResources: CapturedResource[] = []): ImprovementMock {
  let tabsChanged: ((snapshot: TabsSnapshot) => void) | null = null
  let selectionCaptured: ((selection: CapturedSelection) => void) | null = null
  let transcriptCapture: ((event: TranscriptCaptureEvent) => void) | null = null
  let mentorStream: ((event: MentorStreamEvent) => void) | null = null
  const resources: CapturedResource[] = [...initialResources]

  const api: RendererApi = {
    createTab: vi.fn().mockResolvedValue(tabsSnapshot),
    closeTab: vi.fn().mockResolvedValue(tabsSnapshot),
    switchTab: vi.fn().mockResolvedValue(tabsSnapshot),
    navigateActiveTab: vi.fn().mockResolvedValue(tabsSnapshot),
    goBack: vi.fn().mockResolvedValue(tabsSnapshot),
    goForward: vi.fn().mockResolvedValue(tabsSnapshot),
    reload: vi.fn().mockResolvedValue(tabsSnapshot),
    setBrowserBounds: vi.fn(),
    getCapturedResources: vi.fn().mockImplementation(() => Promise.resolve(resources)),
    searchCapturedResources: vi.fn().mockResolvedValue(resources),
    deleteCapturedResource: vi.fn().mockImplementation((id: string) => {
      const index = resources.findIndex((resource) => resource.id === id)
      if (index >= 0) {
        resources.splice(index, 1)
      }
      return Promise.resolve()
    }),
    getXaiStatus: vi.fn().mockResolvedValue({
      hasApiKey: true,
      source: 'environment',
      model: 'grok-4'
    }),
    setTemporaryXaiApiKey: vi.fn().mockResolvedValue({
      hasApiKey: true,
      source: 'temporary',
      model: 'grok-4'
    }),
    captureTranscript: vi.fn().mockResolvedValue({
      type: 'captured',
      capturedAt: '2026-04-26T12:00:00.000Z',
      capture: {
        title: 'Chassis Setup Explained',
        url: 'https://www.youtube.com/watch?v=abc123',
        text: 'Transcript line one.\nTranscript line two.'
      }
    }),
    sendCaptureToMentor: vi.fn().mockResolvedValue(undefined),
    sendMentorMessage: vi.fn().mockResolvedValue(undefined),
    onTabsChanged: vi.fn((callback) => {
      tabsChanged = callback
      return vi.fn()
    }),
    onSelectionCaptured: vi.fn((callback) => {
      selectionCaptured = callback
      return vi.fn()
    }),
    onTranscriptCapture: vi.fn((callback) => {
      transcriptCapture = callback
      return vi.fn()
    }),
    onMentorStream: vi.fn((callback) => {
      mentorStream = callback
      return vi.fn()
    })
  }

  Object.defineProperty(window, 'improvement', {
    configurable: true,
    value: api
  })

  return {
    api,
    emitTabsChanged: (snapshot) => tabsChanged?.(snapshot),
    emitSelectionCaptured: (selection) => selectionCaptured?.(selection),
    emitTranscriptCapture: (event) => transcriptCapture?.(event),
    emitMentorStream: (event) => mentorStream?.(event)
  }
}

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('renders browser tabs and calls tab management APIs', async () => {
    const user = userEvent.setup()
    const { api, emitTabsChanged } = installImprovementMock()

    render(<App />)

    act(() => emitTabsChanged(tabsSnapshot))

    expect(screen.getByTitle('Suspension Geometry')).toBeInTheDocument()
    expect(screen.getByTitle('Welding Basics')).toBeInTheDocument()

    await user.click(screen.getByTitle('Welding Basics'))
    expect(api.switchTab).toHaveBeenCalledWith('tab-2')

    await user.click(screen.getByLabelText('Open new tab'))
    expect(api.createTab).toHaveBeenCalledWith()
  })

  it('routes captured webpage text to the Grok mentor panel', async () => {
    const { api, emitSelectionCaptured } = installImprovementMock()

    render(<App />)

    const selection: CapturedSelection = {
      text: 'Selected paragraph about aero balance.',
      title: 'Aero Article',
      url: 'https://example.com/aero'
    }

    act(() => emitSelectionCaptured(selection))

    expect(await screen.findByText('Selected paragraph about aero balance.')).toBeInTheDocument()
    expect(screen.getByText(/Aero Article/)).toBeInTheDocument()
    expect(api.sendCaptureToMentor).toHaveBeenCalledWith(selection)
  })

  it('shows manual YouTube transcript captures and sends them to Grok on request', async () => {
    const user = userEvent.setup()
    const { api, emitTabsChanged } = installImprovementMock()

    render(<App />)

    expect(screen.queryByRole('button', { name: 'Capture Transcript' })).not.toBeInTheDocument()

    act(() =>
      emitTabsChanged({
        activeTabId: 'youtube-tab',
        tabs: [
          {
            id: 'youtube-tab',
            title: 'Chassis Setup Explained',
            url: 'https://www.youtube.com/watch?v=abc123',
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        ]
      })
    )

    await user.click(screen.getByRole('button', { name: 'Capture Transcript' }))

    expect(await screen.findByText('Transcript captured')).toBeInTheDocument()
    expect(screen.getAllByText(/Chassis Setup Explained/).length).toBeGreaterThan(0)
    expect(screen.getByText('Transcript line one. Transcript line two.')).toBeInTheDocument()
    expect(api.captureTranscript).toHaveBeenCalled()
    expect(api.sendCaptureToMentor).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Send to Grok' }))

    expect(api.sendCaptureToMentor).toHaveBeenCalledWith({
      title: 'Chassis Setup Explained',
      url: 'https://www.youtube.com/watch?v=abc123',
      text: 'Video transcript captured manually.\n\nTranscript line one.\nTranscript line two.'
    })
  })

  it('shows a clear message when the YouTube transcript panel is not open', async () => {
    const user = userEvent.setup()
    const { api, emitTabsChanged } = installImprovementMock()

    vi.mocked(api.captureTranscript).mockResolvedValueOnce({
      type: 'unavailable',
      capturedAt: '2026-04-26T12:00:00.000Z',
      title: 'No Captions Video',
      url: 'https://www.youtube.com/watch?v=nope',
      reason: "Please click 'Show transcript' on the YouTube page first, then try again."
    })

    render(<App />)

    act(() =>
      emitTabsChanged({
        activeTabId: 'youtube-tab',
        tabs: [
          {
            id: 'youtube-tab',
            title: 'No Captions Video',
            url: 'https://www.youtube.com/watch?v=nope',
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        ]
      })
    )

    await user.click(screen.getByRole('button', { name: 'Capture Transcript' }))

    expect(await screen.findByText('Transcript unavailable')).toBeInTheDocument()
    expect(screen.getAllByText("Please click 'Show transcript' on the YouTube page first, then try again.").length).toBeGreaterThan(0)
    expect(api.sendCaptureToMentor).not.toHaveBeenCalled()
  })

  it('shows transcript capture controls on HPAcademy video pages', async () => {
    const user = userEvent.setup()
    const { api, emitTabsChanged } = installImprovementMock()

    vi.mocked(api.captureTranscript).mockResolvedValueOnce({
      type: 'captured',
      capturedAt: '2026-04-26T12:00:00.000Z',
      capture: {
        title: 'EFI Tuning Fundamentals',
        url: 'https://members.hpacademy.com/courses/efi-tuning/lessons/fuel-tables',
        text: 'Welcome to this lesson.\nWe are going to tune the fuel table.'
      }
    })

    render(<App />)

    act(() =>
      emitTabsChanged({
        activeTabId: 'hpa-tab',
        tabs: [
          {
            id: 'hpa-tab',
            title: 'EFI Tuning Fundamentals',
            url: 'https://members.hpacademy.com/courses/efi-tuning/lessons/fuel-tables',
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        ]
      })
    )

    await user.click(screen.getByRole('button', { name: 'Capture Transcript' }))

    expect(await screen.findByText('Transcript captured')).toBeInTheDocument()
    expect(screen.getAllByText(/EFI Tuning Fundamentals/).length).toBeGreaterThan(0)
    expect(screen.getByText('Welcome to this lesson. We are going to tune the fuel table.')).toBeInTheDocument()
  })

  it('renders captured transcripts as clean readable text with optional timestamps', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    installImprovementMock([
      {
        id: 'resource-1',
        type: 'transcript',
        source: 'youtube',
        title: 'Brake Bias Explained',
        url: 'https://www.youtube.com/watch?v=brakes',
        content:
          "00:00 - One of the terms that's often thrown around is brake bias. 00:09 This would easily be one of the most misused terms in setup discussions.",
        capturedAt: '2026-04-26T12:00:00.000Z',
        metadata: { videoId: 'brakes' },
        tags: ['transcript']
      }
    ])

    render(<App />)

    expect((await screen.findAllByText('Brake Bias Explained')).length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        "One of the terms that's often thrown around is brake bias. This would easily be one of the most misused terms in setup discussions."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('00:00')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show timestamps' }))

    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByText('00:09')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy full transcript' }))

    expect(writeText).toHaveBeenCalledWith(
      "00:00 - One of the terms that's often thrown around is brake bias. 00:09 This would easily be one of the most misused terms in setup discussions."
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('saves session notes to local storage', async () => {
    const user = userEvent.setup()
    installImprovementMock()

    render(<App />)

    await user.type(screen.getByPlaceholderText(/write your takeaways/i), 'Remember to review roll center notes.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.localStorage.getItem('improvement.notes')).toBe('Remember to review roll center notes.')
    expect(window.localStorage.getItem('improvement.notesSavedAt')).toBeTruthy()
    expect(screen.getByText(/Saved/)).toBeInTheDocument()
  })

  it('provides learning cell prompt starters', async () => {
    const user = userEvent.setup()
    installImprovementMock()

    render(<App />)
    await screen.findByText(/Using grok-4/)

    await user.click(screen.getByRole('button', { name: /ExplainClarify the concept/ }))

    expect(screen.getByPlaceholderText('Ask a follow-up...')).toHaveValue('Explain this at my current technical level.')
  })

  it('formats mentor stream responses and copies assistant text', async () => {
    const user = userEvent.setup()
    const { emitMentorStream } = installImprovementMock()
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    render(<App />)

    act(() =>
      emitMentorStream({
        type: 'started',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: '',
          status: 'streaming'
        }
      })
    )

    act(() =>
      emitMentorStream({
        type: 'delta',
        id: 'assistant-1',
        delta: '## Key Idea\n\n- Connect theory to fabrication\n- Check assumptions'
      })
    )

    act(() => emitMentorStream({ type: 'done', id: 'assistant-1' }))

    expect(screen.getByRole('heading', { name: 'Key Idea' })).toBeInTheDocument()
    expect(screen.getByText('Connect theory to fabrication')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('## Key Idea\n\n- Connect theory to fabrication\n- Check assumptions'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
