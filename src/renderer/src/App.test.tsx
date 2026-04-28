import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { CapturedSelection, MentorStreamEvent, RendererApi, TabsSnapshot, TranscriptCaptureEvent } from '../../shared/ipc'
import type { LearningGoal, LearningGoalInput, LearningGoalUpdate, Project, ProjectInput, ProjectProgress, ProjectResourceLink } from '../../shared/projects'
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
  const projects: Project[] = []
  const goals: LearningGoal[] = []
  const links: ProjectResourceLink[] = []

  const progressForProject = (projectId: string): ProjectProgress => {
    const projectGoals = goals.filter((goal) => goal.projectId === projectId)
    const completedGoals = projectGoals.filter((goal) => goal.status === 'done').length

    return {
      projectId,
      totalGoals: projectGoals.length,
      completedGoals,
      percentComplete: projectGoals.length === 0 ? 0 : Math.round((completedGoals / projectGoals.length) * 100)
    }
  }

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
    getProjects: vi.fn().mockImplementation(() => Promise.resolve([...projects])),
    createProject: vi.fn().mockImplementation((input: ProjectInput) => {
      const project: Project = {
        id: `project-${projects.length + 1}`,
        title: input.title,
        description: input.description,
        type: input.type,
        status: input.status ?? 'active',
        createdAt: input.createdAt ?? '2026-04-26T12:00:00.000Z',
        targetDate: input.targetDate,
        notes: input.notes
      }
      projects.unshift(project)
      return Promise.resolve(project)
    }),
    updateProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockImplementation((id: string, _deleteAssociatedResources = false) => Promise.resolve()),
    linkResourceToProject: vi.fn().mockImplementation((resourceId: string, projectId: string, learningGoalId?: string | null) => {
      const existing = links.find((link) => link.resourceId === resourceId && link.projectId === projectId)
      const learningGoal = learningGoalId ? goals.find((goal) => goal.id === learningGoalId) : undefined
      if (!existing) {
        const project = projects.find((item) => item.id === projectId)
        if (project) {
          links.push({
            id: `link-${links.length + 1}`,
            resourceId,
            projectId,
            learningGoalId: learningGoal?.id,
            linkedAt: '2026-04-26T12:00:00.000Z',
            notes: '',
            relevanceScore: 1,
            project,
            learningGoal
          })
        }
      } else {
        existing.learningGoalId = learningGoal?.id
        existing.learningGoal = learningGoal
      }
      return Promise.resolve(links.filter((link) => link.resourceId === resourceId))
    }),
    unlinkResourceFromProject: vi.fn().mockImplementation((resourceId: string, projectId: string) => {
      const index = links.findIndex((link) => link.resourceId === resourceId && link.projectId === projectId)
      if (index >= 0) {
        links.splice(index, 1)
      }
      return Promise.resolve(links.filter((link) => link.resourceId === resourceId))
    }),
    getResourceProjectLinks: vi.fn().mockImplementation((resourceId: string) =>
      Promise.resolve(links.filter((link) => link.resourceId === resourceId))
    ),
    getProjectResources: vi.fn().mockImplementation((projectId: string) =>
      Promise.resolve(resources.filter((resource) => links.some((link) => link.projectId === projectId && link.resourceId === resource.id)))
    ),
    getLearningGoals: vi.fn().mockImplementation((projectId: string) =>
      Promise.resolve(goals.filter((goal) => goal.projectId === projectId))
    ),
    createLearningGoal: vi.fn().mockImplementation((input: LearningGoalInput) => {
      const goal: LearningGoal = {
        id: `goal-${goals.length + 1}`,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: input.status ?? 'todo',
        priority: input.priority,
        createdAt: input.createdAt ?? '2026-04-26T12:00:00.000Z',
        completedAt: input.completedAt,
        notes: input.notes
      }
      goals.push(goal)
      return Promise.resolve(goal)
    }),
    updateLearningGoal: vi.fn().mockImplementation((update: LearningGoalUpdate) => {
      const goal = goals.find((item) => item.id === update.id)
      if (!goal) {
        return Promise.resolve(null)
      }
      Object.assign(goal, update)
      if (update.status === 'done' && !goal.completedAt) {
        goal.completedAt = '2026-04-26T13:00:00.000Z'
      }
      if (update.status && update.status !== 'done') {
        goal.completedAt = undefined
      }
      return Promise.resolve(goal)
    }),
    deleteLearningGoal: vi.fn().mockImplementation((id: string) => {
      const index = goals.findIndex((goal) => goal.id === id)
      if (index >= 0) {
        goals.splice(index, 1)
      }
      return Promise.resolve()
    }),
    markLearningGoalComplete: vi.fn().mockImplementation((id: string) => {
      const goal = goals.find((item) => item.id === id)
      if (goal) {
        goal.status = 'done'
        goal.completedAt = '2026-04-26T13:00:00.000Z'
      }
      return Promise.resolve(goal ?? null)
    }),
    getProjectProgress: vi.fn().mockImplementation((projectId: string) => Promise.resolve(progressForProject(projectId))),
    importPdfResource: vi.fn().mockResolvedValue(null),
    openPdfResource: vi.fn().mockResolvedValue(tabsSnapshot),
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

  it('keeps the browser panel to the right of the learning workspace', async () => {
    installImprovementMock()

    render(<App />)
    await screen.findByText(/Using grok-4/)

    const panelOrder = Array.from(
      document.querySelectorAll('.workspace .sidebar, .workspace .learning-center, .workspace .browser-column')
    ).map((element) => {
      if (element.classList.contains('sidebar')) {
        return 'sidebar'
      }

      return element.classList.contains('learning-center') ? 'learning' : 'browser'
    })

    expect(panelOrder).toEqual(['sidebar', 'learning', 'browser'])
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

  it('opens imported PDF resources in the browser', async () => {
    const user = userEvent.setup()
    const { api } = installImprovementMock([
      {
        id: 'pdf-1',
        type: 'pdf',
        source: 'file-upload',
        title: 'Vehicle Dynamics Notes',
        url: 'file:///Users/david/Library/Application%20Support/Improvement/pdfs/vehicle-dynamics.pdf',
        content: 'Extracted PDF text about load transfer.',
        capturedAt: '2026-04-26T12:00:00.000Z',
        metadata: {
          filePath: '/Users/david/Library/Application Support/Improvement/pdfs/vehicle-dynamics.pdf',
          pageCount: 12
        },
        tags: ['pdf']
      }
    ])

    render(<App />)

    expect((await screen.findAllByText('Vehicle Dynamics Notes')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Open PDF in Browser' }))

    expect(api.openPdfResource).toHaveBeenCalledWith('pdf-1')
  })

  it('creates projects and links resources to them', async () => {
    const user = userEvent.setup()
    const { api } = installImprovementMock([
      {
        id: 'resource-1',
        type: 'pdf',
        source: 'file-upload',
        title: 'Chassis Stiffness Notes',
        content: 'Notes about torsional rigidity.',
        capturedAt: '2026-04-26T12:00:00.000Z',
        metadata: {},
        tags: ['pdf']
      }
    ])

    render(<App />)

    expect((await screen.findAllByText('Chassis Stiffness Notes')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Spec Miata Build')
    await user.type(screen.getByPlaceholderText('Description (optional)'), 'Organize chassis and engine resources.')
    await user.selectOptions(screen.getByDisplayValue('General'), 'build')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.click(await screen.findByRole('button', { name: 'Link to Project' }))

    expect(api.linkResourceToProject).toHaveBeenCalledWith('resource-1', 'project-1', undefined)
    expect(await screen.findByText('Linked to Spec Miata Build')).toBeInTheDocument()

    expect(await screen.findByText('1 linked')).toBeInTheDocument()
  })

  it('creates learning goals, updates progress, and links resources to goals', async () => {
    const user = userEvent.setup()
    const { api } = installImprovementMock([
      {
        id: 'resource-1',
        type: 'pdf',
        source: 'file-upload',
        title: 'Bearing Clearance Notes',
        content: 'Measure clearance with plastigage and micrometers.',
        capturedAt: '2026-04-26T12:00:00.000Z',
        metadata: {},
        tags: ['pdf']
      }
    ])

    render(<App />)

    expect((await screen.findAllByText('Bearing Clearance Notes')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Engine Course')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.click(await screen.findByRole('button', { name: 'New Goal' }))
    await user.type(screen.getByPlaceholderText('Goal title'), 'Understand bearing clearance')
    await user.type(screen.getByPlaceholderText('What should this goal help you understand or do?'), 'Learn measurement process.')
    await user.selectOptions(screen.getByDisplayValue('Priority 3'), '5')
    await user.click(screen.getByRole('button', { name: 'Create Goal' }))

    expect((await screen.findAllByText('Understand bearing clearance')).length).toBeGreaterThan(0)
    // Progress text removed in streamlined UI cleanup; backend progress tracking remains

    await user.selectOptions(screen.getByLabelText('Change status for Understand bearing clearance'), 'done')

    await user.click(await screen.findByRole('button', { name: 'Link to Project' }))

    expect(api.linkResourceToProject).toHaveBeenCalledWith('resource-1', 'project-1', 'goal-1')
    expect(await screen.findByText('Linked to Engine Course / Understand bearing clearance')).toBeInTheDocument()
  })

  it('shows project goals in the left tree and assigns schedule blocks', async () => {
    const user = userEvent.setup()
    installImprovementMock()

    render(<App />)

    expect(screen.getByText('Learning map')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Engine Course')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.click(await screen.findByRole('button', { name: 'New Goal' }))
    await user.type(screen.getByPlaceholderText('Goal title'), 'Understand bearing clearance')
    await user.click(screen.getByRole('button', { name: 'Create Goal' }))

    expect((await screen.findAllByText('Engine Course')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Understand bearing clearance')).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Schedule' })[0])
    expect(screen.getByText('Today')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/8:00-9:00/), 'goal:project-1:goal-1')

    expect(screen.getByLabelText(/8:00-9:00/)).toHaveValue('goal:project-1:goal-1')
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

  it('shows knowledge base context used for mentor responses', async () => {
    const { emitMentorStream } = installImprovementMock()

    render(<App />)

    act(() =>
      emitMentorStream({
        type: 'context',
        status: 'searching',
        resources: []
      })
    )

    expect(screen.getByText('Searching your knowledge base...')).toBeInTheDocument()

    act(() =>
      emitMentorStream({
        type: 'context',
        status: 'ready',
        resources: [
          {
            id: 'resource-1',
            title: 'Brake Bias Fundamentals',
            type: 'pdf',
            source: 'file-upload'
          }
        ]
      })
    )

    expect(screen.getByText('Using 1 relevant resource')).toBeInTheDocument()
    expect(screen.getByText('Brake Bias Fundamentals')).toBeInTheDocument()
  })
})
