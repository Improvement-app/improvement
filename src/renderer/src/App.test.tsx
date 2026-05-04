import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { CapturedSelection, MentorStreamEvent, RendererApi, ResourceImportedEvent, TabsSnapshot, TranscriptCaptureEvent } from '../../shared/ipc'
import type { KnowledgeGapStatus, ProjectKnowledgeGapSummary } from '../../shared/knowledgeGaps'
import type { Project, ProjectInput, ProjectResourceLink } from '../../shared/projects'
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
  emitResourceImported: (event: ResourceImportedEvent) => void
  addResource: (resource: CapturedResource) => void
}

function installImprovementMock(initialResources: CapturedResource[] = []): ImprovementMock {
  let tabsChanged: ((snapshot: TabsSnapshot) => void) | null = null
  let selectionCaptured: ((selection: CapturedSelection) => void) | null = null
  let transcriptCapture: ((event: TranscriptCaptureEvent) => void) | null = null
  let mentorStream: ((event: MentorStreamEvent) => void) | null = null
  let resourceImported: ((event: ResourceImportedEvent) => void) | null = null
  const resources: CapturedResource[] = [...initialResources]
  const projects: Project[] = []
  const links: ProjectResourceLink[] = []
  const gapStatuses = new Map<string, KnowledgeGapStatus>()

  const knowledgeGapSummary = (projectId: string): ProjectKnowledgeGapSummary | null => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      return null
    }

    const linkedResources = resources.filter((resource) =>
      links.some((link) => link.projectId === projectId && link.resourceId === resource.id)
    )

    return {
      projectId,
      projectTitle: project.title,
      generatedAt: '2026-05-04T12:00:00.000Z',
      resourceCount: linkedResources.length,
      noteSignalCount: 0,
      coveredTopics: linkedResources.map((resource) => resource.title),
      gaps:
        linkedResources.length === 0
          ? (() => {
              const gapId = `${projectId}:link-first-source`
              const status = gapStatuses.get(gapId) ?? 'open'

              return status === 'open' || status === 'in_progress'
                ? [
                    {
                      id: gapId,
                      projectId,
                      title: 'Link one strong source',
                      description: 'No captured resources are linked to this project yet.',
                      recommendation: 'Import a PDF, capture a transcript, or attach an existing resource before asking for a roadmap.',
                      status,
                      severity: 3,
                      detectedBy: 'heuristic',
                      evidence: [
                        {
                          type: 'project',
                          id: projectId,
                          title: project.title,
                          detail: 'Project has zero linked resources.'
                        }
                      ],
                      createdAt: '2026-05-04T12:00:00.000Z',
                      updatedAt: '2026-05-04T12:00:00.000Z',
                      metadata: { resourceCount: 0 }
                    }
                  ]
                : []
            })()
          : []
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
    setActiveProjectContext: vi.fn(),
    linkResourceToProject: vi.fn().mockImplementation((resourceId: string, projectId: string) => {
      const existing = links.find((link) => link.resourceId === resourceId && link.projectId === projectId)
      if (!existing) {
        const project = projects.find((item) => item.id === projectId)
        if (project) {
          links.push({
            id: `link-${links.length + 1}`,
            resourceId,
            projectId,
            linkedAt: '2026-04-26T12:00:00.000Z',
            notes: '',
            relevanceScore: 1,
            project
          })
        }
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
    getProjectKnowledgeGaps: vi.fn().mockImplementation((projectId: string) => Promise.resolve(knowledgeGapSummary(projectId))),
    updateKnowledgeGapStatus: vi.fn().mockImplementation((gapId: string, status: KnowledgeGapStatus) => {
      gapStatuses.set(gapId, status)
      const [projectId] = gapId.split(':')
      return Promise.resolve(knowledgeGapSummary(projectId))
    }),
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
    captureTranscript: vi.fn().mockImplementation(() => {
      const resource: CapturedResource = {
        id: `resource-${resources.length + 1}`,
        type: 'transcript',
        source: 'youtube.com',
        title: 'Chassis Setup Explained',
        url: 'https://www.youtube.com/watch?v=abc123',
        content: 'Transcript line one.\nTranscript line two.',
        capturedAt: '2026-04-26T12:00:00.000Z',
        metadata: { capturedFrom: 'manual-transcript-capture' },
        tags: ['transcript']
      }
      resources.unshift(resource)

      return Promise.resolve({
        type: 'captured',
        capturedAt: resource.capturedAt,
        capture: {
          title: resource.title,
          url: resource.url ?? '',
          text: resource.content
        },
        resource
      })
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
    }),
    onResourceImported: vi.fn((callback) => {
      resourceImported = callback
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
    emitMentorStream: (event) => mentorStream?.(event),
    emitResourceImported: (event) => resourceImported?.(event),
    addResource: (resource) => resources.unshift(resource)
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

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Chassis Study')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

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
    expect(api.captureTranscript).toHaveBeenCalled()
    expect(api.linkResourceToProject).toHaveBeenCalledWith('resource-1', 'project-1')
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
    expect(api.captureTranscript).toHaveBeenCalled()
  })

  it('shows transcript capture controls on Udemy lecture pages', async () => {
    const user = userEvent.setup()
    const { api, emitTabsChanged } = installImprovementMock()

    vi.mocked(api.captureTranscript).mockResolvedValueOnce({
      type: 'captured',
      capturedAt: '2026-04-26T12:00:00.000Z',
      capture: {
        title: 'Fusion 360 Fundamentals',
        url: 'https://www.udemy.com/course/fusion-360/learn/lecture/123456',
        text: 'Welcome back to the course.\nIn this lesson we will sketch constraints.'
      }
    })

    render(<App />)

    act(() =>
      emitTabsChanged({
        activeTabId: 'udemy-tab',
        tabs: [
          {
            id: 'udemy-tab',
            title: 'Fusion 360 Fundamentals',
            url: 'https://www.udemy.com/course/fusion-360/learn/lecture/123456',
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        ]
      })
    )

    await user.click(screen.getByRole('button', { name: 'Capture Transcript' }))

    expect(await screen.findByText('Transcript captured')).toBeInTheDocument()
    expect(screen.getAllByText(/Fusion 360 Fundamentals/).length).toBeGreaterThan(0)
    expect(api.captureTranscript).toHaveBeenCalled()
  })

  it('shows linked captured resources in the project tree and copies transcript text', async () => {
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

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Brake System Study')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.selectOptions(await screen.findByLabelText('Attach captured resource to Brake System Study'), 'resource-1')
    expect((await screen.findAllByText('Brake Bias Explained')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Captured resources' })).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Vehicle Dynamics Study')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.selectOptions(await screen.findByLabelText('Attach captured resource to Vehicle Dynamics Study'), 'pdf-1')
    expect((await screen.findAllByText('Vehicle Dynamics Notes')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Open PDF' }))

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

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Spec Miata Build')
    await user.type(screen.getByPlaceholderText('Description (optional)'), 'Organize chassis and engine resources.')
    await user.selectOptions(screen.getByDisplayValue('General'), 'build')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await user.selectOptions(await screen.findByLabelText('Attach captured resource to Spec Miata Build'), 'resource-1')

    expect(api.linkResourceToProject).toHaveBeenCalledWith('resource-1', 'project-1')
    expect((await screen.findAllByText('Chassis Stiffness Notes')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/1 resource/)).length).toBeGreaterThan(0)
  })

  it('shows knowledge gap recommendations for the selected project', async () => {
    const user = userEvent.setup()
    const { api } = installImprovementMock()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Chassis Roadmap')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    expect(await screen.findByText('Link one strong source')).toBeInTheDocument()
    expect(screen.getByText('Import a PDF, capture a transcript, or attach an existing resource before asking for a roadmap.')).toBeInTheDocument()
    expect(api.getProjectKnowledgeGaps).toHaveBeenCalledWith('project-1', '')

    await user.click(screen.getByRole('button', { name: 'Work on this' }))
    expect(api.updateKnowledgeGapStatus).toHaveBeenCalledWith('project-1:link-first-source', 'in_progress')
    expect(await screen.findByText(/In progress · Severity 3/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(api.updateKnowledgeGapStatus).toHaveBeenCalledWith('project-1:link-first-source', 'dismissed')
    await waitFor(() => expect(screen.queryByText('Link one strong source')).not.toBeInTheDocument())
  })

  it('syncs active project context and refreshes PDF imports from the browser New Tab page', async () => {
    const user = userEvent.setup()
    const { api, addResource, emitResourceImported } = installImprovementMock()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Vehicle Dynamics Study')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    await waitFor(() => expect(api.setActiveProjectContext).toHaveBeenCalledWith('project-1'))

    const pdfResource: CapturedResource = {
      id: 'pdf-1',
      type: 'pdf',
      source: 'file-upload',
      title: 'Vehicle Dynamics Notes',
      url: 'file:///Users/david/Library/Application%20Support/Improvement/pdfs/vehicle-dynamics.pdf',
      content: 'Extracted PDF text about load transfer.',
      capturedAt: '2026-05-04T12:00:00.000Z',
      metadata: {
        filePath: '/Users/david/Library/Application Support/Improvement/pdfs/vehicle-dynamics.pdf'
      },
      tags: ['pdf']
    }

    addResource(pdfResource)
    await api.linkResourceToProject('pdf-1', 'project-1')

    act(() => emitResourceImported({ resource: pdfResource, linkedProjectId: 'project-1' }))

    expect((await screen.findAllByText('Vehicle Dynamics Notes')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/1 resource/)).length).toBeGreaterThan(0)
  })

  it('assigns schedule blocks to projects', async () => {
    const user = userEvent.setup()
    installImprovementMock()

    render(<App />)

    expect(screen.getByText('Learning map')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByPlaceholderText('Project title'), 'Engine Course')
    await user.click(screen.getByRole('button', { name: 'Create Project' }))

    expect((await screen.findAllByText('Engine Course')).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Schedule' })[0])
    expect(screen.getByText('Today')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/8:00-9:00/), 'project:project-1')

    expect(screen.getByLabelText(/8:00-9:00/)).toHaveValue('project:project-1')
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

  it('provides pomodoro timer controls in the learning pane', async () => {
    const user = userEvent.setup()
    installImprovementMock()

    render(<App />)

    const timer = screen.getByLabelText('Pomodoro timer')
    expect(timer).toHaveTextContent('25:00')

    await user.click(screen.getByRole('button', { name: 'Break' }))
    expect(timer).toHaveTextContent('05:00')

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(timer).toHaveTextContent('05:00')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
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
