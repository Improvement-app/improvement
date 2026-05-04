import type { FormEvent, ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type {
  BrowserTab,
  CapturedSelection,
  MentorMessage,
  RagResourceReference,
  ResourceImportedEvent,
  TabsSnapshot,
  TranscriptCaptureEvent,
  XaiStatus
} from '../../shared/ipc'
import type { KnowledgeGapRecommendation, ProjectKnowledgeGapSummary } from '../../shared/knowledgeGaps'
import type {
  Project,
  ProjectInput,
  ProjectResourceLink,
  ProjectType
} from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'

const initialSnapshot: TabsSnapshot = {
  tabs: [],
  activeTabId: null
}

type LeftSidebarMode = 'projects' | 'schedule'
type PomodoroMode = 'focus' | 'break'

const pomodoroDurations: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  break: 5 * 60
}

const scheduleSlots = [
  '8:00-9:00',
  '9:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-1:00',
  '1:00-2:00',
  '2:00-3:00',
  '3:00-4:00',
  '4:00-5:00'
]

function activeTabFrom(snapshot: TabsSnapshot): BrowserTab | null {
  return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? null
}

function formatHostname(url: string): string {
  if (url === 'improvement://new-tab') {
    return 'New Tab'
  }

  try {
    const parsed = new URL(url)

    if (parsed.protocol === 'file:') {
      return decodeURIComponent(parsed.pathname.split('/').at(-1) || 'Local file')
    }

    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatAddress(url: string): string {
  return url === 'improvement://new-tab' ? '' : url
}

function isYouTubeWatchPage(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    return (hostname === 'youtube.com' || hostname === 'm.youtube.com') && parsed.pathname === '/watch' && Boolean(parsed.searchParams.get('v'))
  } catch {
    return false
  }
}

function isHPAcademyVideoPage(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (hostname !== 'hpacademy.com' && hostname !== 'members.hpacademy.com') {
      return false
    }

    return /\/(courses?|lessons?|modules?|webinars?|learn|members?|videos?)\b/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function isUdemyVideoPage(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (hostname !== 'udemy.com' && hostname !== 'members.udemy.com') {
      return false
    }

    return /\/(course|courses|learn|lecture|watch)/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function formatSavedTime(value: string | null): string {
  if (!value) {
    return 'Not saved yet'
  }

  return `Saved ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))}`
}

function formatResourceDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function resourceIcon(type: string): string {
  if (type === 'transcript') return 'T'
  if (type === 'pdf') return 'P'
  if (type === 'article') return 'A'
  if (type === 'textbook') return 'B'
  if (type === 'note') return 'N'
  return 'R'
}

function formatPomodoroTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function resourceFromTranscriptEvent(event: Extract<TranscriptCaptureEvent, { type: 'captured' }>): CapturedResource {
  return {
    id: crypto.randomUUID(),
    type: 'transcript',
    source: formatHostname(event.capture.url),
    title: event.capture.title || 'Video transcript',
    url: event.capture.url,
    content: event.capture.text,
    capturedAt: event.capturedAt,
    metadata: { capturedFrom: 'manual-transcript-capture' },
    tags: ['transcript']
  }
}

function FormattedMentorContent({ content }: { content: string }): ReactElement {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    return <p className="mentor-placeholder">Grok is thinking...</p>
  }

  return (
    <div className="mentor-formatted-content">
      {blocks.map((block, index) => {
        const bulletLines = block.split('\n').filter((line) => /^[-*]\s+/.test(line.trim()))

        if (/^#{1,3}\s+/.test(block)) {
          return <h4 key={index}>{block.replace(/^#{1,3}\s+/, '')}</h4>
        }

        if (bulletLines.length > 0 && bulletLines.length === block.split('\n').length) {
          return (
            <ul key={index}>
              {bulletLines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^[-*]\s+/, '')}</li>
              ))}
            </ul>
          )
        }

        return <p key={index}>{block}</p>
      })}
    </div>
  )
}

export default function App(): ReactElement {
  const browserFrameRef = useRef<HTMLDivElement | null>(null)
  const scheduleBrowserBoundsUpdateRef = useRef<() => void>(() => undefined)
  const selectedProjectIdRef = useRef('')
  const [snapshot, setSnapshot] = useState<TabsSnapshot>(initialSnapshot)
  const [address, setAddress] = useState('')
  const [leftMode, setLeftMode] = useState<LeftSidebarMode>('projects')
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set())
  const [scheduleAssignments, setScheduleAssignments] = useState<Record<string, string>>({})
  const [xaiStatus, setXaiStatus] = useState<XaiStatus | null>(null)
  const [temporaryApiKey, setTemporaryApiKey] = useState('')
  const [mentorMessages, setMentorMessages] = useState<MentorMessage[]>([])
  const [followUp, setFollowUp] = useState('')
  const [mentorError, setMentorError] = useState<string | null>(null)
  const [isMentorStreaming, setIsMentorStreaming] = useState(false)
  const [ragStatus, setRagStatus] = useState<'idle' | 'searching' | 'ready'>('idle')
  const [ragResources, setRagResources] = useState<RagResourceReference[]>([])
  const [notes, setNotes] = useState(() => window.localStorage.getItem('improvement.notes') ?? '')
  const [lastSavedAt, setLastSavedAt] = useState(() => window.localStorage.getItem('improvement.notesSavedAt'))
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null)
  const [transcriptNotice, setTranscriptNotice] = useState<TranscriptCaptureEvent | null>(null)
  const [capturedResources, setCapturedResources] = useState<CapturedResource[]>([])
  const [projectResourcesByProject, setProjectResourcesByProject] = useState<Record<string, CapturedResource[]>>({})
  const [knowledgeGapSummary, setKnowledgeGapSummary] = useState<ProjectKnowledgeGapSummary | null>(null)
  const [isLoadingKnowledgeGaps, setIsLoadingKnowledgeGaps] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedResourceLinks, setSelectedResourceLinks] = useState<ProjectResourceLink[]>([])
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectType, setNewProjectType] = useState<'course' | 'build' | 'skill' | 'general'>('general')
  const [isCapturingTranscript, setIsCapturingTranscript] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('focus')
  const [pomodoroSeconds, setPomodoroSeconds] = useState(pomodoroDurations.focus)
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false)

  const activeTab = useMemo(() => activeTabFrom(snapshot), [snapshot])
  const canCaptureTranscript = Boolean(
    activeTab && (isYouTubeWatchPage(activeTab.url) || isHPAcademyVideoPage(activeTab.url) || isUdemyVideoPage(activeTab.url))
  )
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const pomodoroTime = formatPomodoroTime(pomodoroSeconds)
  const linkedProjectResources = useMemo(
    () => Object.values(projectResourcesByProject).flat(),
    [projectResourcesByProject]
  )
  const selectedResource = useMemo(
    () =>
      capturedResources.find((resource) => resource.id === selectedResourceId) ??
      linkedProjectResources.find((resource) => resource.id === selectedResourceId) ??
      null,
    [capturedResources, linkedProjectResources, selectedResourceId]
  )
  const selectedKnowledgeGapSummary = knowledgeGapSummary?.projectId === selectedProjectId ? knowledgeGapSummary : null
  const selectedKnowledgeGaps = selectedKnowledgeGapSummary?.gaps ?? []

  useEffect(() => {
    window.improvement.getXaiStatus().then(setXaiStatus).catch(() => {
      setMentorError('Unable to read xAI API key status from the main process.')
    })
    void loadCapturedResources()
    void loadProjects()

    const disposeTabs = window.improvement.onTabsChanged((nextSnapshot) => {
      setSnapshot(nextSnapshot)
      const nextActiveTab = activeTabFrom(nextSnapshot)
      if (nextActiveTab) {
        setAddress(formatAddress(nextActiveTab.url))
      }
    })

    const disposeSelections = window.improvement.onSelectionCaptured((selection) => {
      void sendCaptureToMentor(selection)
    })

    const disposeMentorStream = window.improvement.onMentorStream((event) => {
      if (event.type === 'context') {
        setRagStatus(event.status)
        setRagResources(event.resources)
        return
      }

      if (event.type === 'started') {
        setMentorError(null)
        setIsMentorStreaming(true)
        setMentorMessages((messages) => [...messages, event.message])
        return
      }

      if (event.type === 'delta') {
        setMentorMessages((messages) =>
          messages.map((message) =>
            message.id === event.id ? { ...message, content: `${message.content}${event.delta}` } : message
          )
        )
        return
      }

      if (event.type === 'done') {
        setIsMentorStreaming(false)
        setMentorMessages((messages) =>
          messages.map((message) => (message.id === event.id ? { ...message, status: 'complete' } : message))
        )
        return
      }

      setIsMentorStreaming(false)
      setMentorError(event.error)
      if (event.id) {
        setMentorMessages((messages) =>
          messages.map((message) =>
            message.id === event.id ? { ...message, content: event.error, status: 'error' } : message
          )
        )
      }
    })

    const disposeResourceImported = window.improvement.onResourceImported((event) => {
      void refreshAfterResourceImport(event)
    })

    return () => {
      disposeTabs()
      disposeSelections()
      disposeMentorStream()
      disposeResourceImported()
    }
  }, [])

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId
    window.improvement.setActiveProjectContext(selectedProjectId || null)
  }, [selectedProjectId])

  const loadCapturedResources = async (fallback?: CapturedResource): Promise<void> => {
    try {
      const resources = await window.improvement.getCapturedResources()
      const nextResources = resources.length > 0 || !fallback ? resources : [fallback]
      let nextProjectResources: CapturedResource[] = []
      setCapturedResources(nextResources)
      if (selectedProjectId) {
        nextProjectResources = await window.improvement.getProjectResources(selectedProjectId)
        setProjectResourcesByProject((items) => ({ ...items, [selectedProjectId]: nextProjectResources }))
      }
      const visibleResources = selectedProjectId ? nextProjectResources : nextResources
      setSelectedResourceId((currentId) =>
        fallback?.id ??
        (currentId && visibleResources.some((resource) => resource.id === currentId)
          ? currentId
          : null)
      )
    } catch {
      if (fallback) {
        setCapturedResources((resources) => [fallback, ...resources])
        setSelectedResourceId(fallback.id)
      }
      setMentorError('Unable to load saved learning resources.')
    }
  }

  const loadProjects = async (): Promise<void> => {
    try {
      const nextProjects = await window.improvement.getProjects()
      const resourceEntries = await Promise.all(
        nextProjects.map(async (project) => [project.id, await window.improvement.getProjectResources(project.id)] as const)
      )
      setProjects(nextProjects)
      setProjectResourcesByProject(Object.fromEntries(resourceEntries))
      setExpandedProjectIds((expandedIds) => new Set([...expandedIds, ...nextProjects.map((project) => project.id)]))
    } catch {
      setMentorError('Unable to load projects.')
    }
  }

  const loadProjectResources = async (projectId: string): Promise<CapturedResource[]> => {
    if (!projectId) {
      return []
    }

    const resources = await window.improvement.getProjectResources(projectId)
    setProjectResourcesByProject((items) => ({ ...items, [projectId]: resources }))
    return resources
  }

  const loadProjectWorkspace = async (projectId: string): Promise<CapturedResource[]> => {
    return loadProjectResources(projectId)
  }

  const loadKnowledgeGaps = async (projectId: string, sessionNotes = notes): Promise<void> => {
    if (!projectId) {
      setKnowledgeGapSummary(null)
      return
    }

    setIsLoadingKnowledgeGaps(true)
    try {
      setKnowledgeGapSummary(await window.improvement.getProjectKnowledgeGaps(projectId, sessionNotes))
    } catch {
      setKnowledgeGapSummary(null)
      setMentorError('Unable to analyze knowledge gaps for this project.')
    } finally {
      setIsLoadingKnowledgeGaps(false)
    }
  }

  const refreshAfterResourceImport = async (event: ResourceImportedEvent): Promise<void> => {
    try {
      const nextResources = await window.improvement.getCapturedResources()
      const nextProjects = await window.improvement.getProjects()
      const resourceEntries = await Promise.all(
        nextProjects.map(async (project) => [project.id, await window.improvement.getProjectResources(project.id)] as const)
      )
      const nextProjectResourcesByProject = Object.fromEntries(resourceEntries)
      const projectId = event.linkedProjectId ?? selectedProjectIdRef.current

      setCapturedResources(nextResources.length > 0 ? nextResources : [event.resource])
      setProjects(nextProjects)
      setProjectResourcesByProject(nextProjectResourcesByProject)
      setExpandedProjectIds((expandedIds) => (projectId ? new Set([...expandedIds, projectId]) : expandedIds))
      setSelectedResourceId(event.resource.id)
      if (projectId) {
        await loadKnowledgeGaps(projectId)
      }
    } catch {
      setCapturedResources((resources) =>
        resources.some((resource) => resource.id === event.resource.id) ? resources : [event.resource, ...resources]
      )
      setSelectedResourceId(event.resource.id)
      setMentorError('Unable to refresh resources after importing the PDF.')
    }
  }

  useEffect(() => {
    if (!selectedResource) {
      setSelectedResourceLinks([])
      return
    }

    window.improvement.getResourceProjectLinks(selectedResource.id).then(setSelectedResourceLinks).catch(() => {
      setSelectedResourceLinks([])
    })
  }, [selectedResource?.id])

  useEffect(() => {
    if (!isPomodoroRunning) {
      return
    }

    const intervalId = window.setInterval(() => {
      setPomodoroSeconds((seconds) => {
        if (seconds > 1) {
          return seconds - 1
        }

        setIsPomodoroRunning(false)
        const nextMode: PomodoroMode = pomodoroMode === 'focus' ? 'break' : 'focus'
        setPomodoroMode(nextMode)
        return pomodoroDurations[nextMode]
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isPomodoroRunning, pomodoroMode])

  useEffect(() => {
    const frame = browserFrameRef.current

    if (!frame) {
      return
    }

    let animationFrameId: number | null = null

    const updateBounds = (): void => {
      const rect = frame.getBoundingClientRect()
      window.improvement.setBrowserBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
    }

    const scheduleUpdateBounds = (): void => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        updateBounds()
      })
    }

    scheduleBrowserBoundsUpdateRef.current = scheduleUpdateBounds
    scheduleUpdateBounds()

    const observer = new ResizeObserver(scheduleUpdateBounds)
    observer.observe(frame)
    window.addEventListener('resize', scheduleUpdateBounds)
    window.visualViewport?.addEventListener('resize', scheduleUpdateBounds)

    return () => {
      scheduleBrowserBoundsUpdateRef.current = () => undefined
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      observer.disconnect()
      window.removeEventListener('resize', scheduleUpdateBounds)
      window.visualViewport?.removeEventListener('resize', scheduleUpdateBounds)
    }
  }, [snapshot.activeTabId])

  const scheduleBrowserBoundsUpdate = (): void => {
    scheduleBrowserBoundsUpdateRef.current()
  }

  const submitNavigation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSnapshot(await window.improvement.navigateActiveTab(address))
  }

  const createTab = async (): Promise<void> => {
    setSnapshot(await window.improvement.createTab())
  }

  const closeTab = async (tabId: string): Promise<void> => {
    setSnapshot(await window.improvement.closeTab(tabId))
  }

  const saveTemporaryApiKey = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setMentorError(null)
    setXaiStatus(await window.improvement.setTemporaryXaiApiKey(temporaryApiKey))
    setTemporaryApiKey('')
  }

  const selectProject = async (projectId: string): Promise<void> => {
    setSelectedProjectId(projectId)
    if (!projectId) {
      setSelectedResourceId(null)
      setKnowledgeGapSummary(null)
      return
    }

    const resources = await loadProjectWorkspace(projectId)
    await loadKnowledgeGaps(projectId)
    setSelectedResourceId((currentId) =>
      currentId && resources.some((resource) => resource.id === currentId)
        ? currentId
        : null
    )
  }

  const toggleProjectExpanded = (projectId: string): void => {
    setExpandedProjectIds((items) => {
      const nextItems = new Set(items)
      if (nextItems.has(projectId)) {
        nextItems.delete(projectId)
      } else {
        nextItems.add(projectId)
      }
      return nextItems
    })
  }

  const handleScheduleAssignment = async (slot: string, value: string): Promise<void> => {
    setScheduleAssignments((items) => ({ ...items, [slot]: value }))

    if (!value) {
      return
    }

    const [kind, projectId] = value.split(':')
    if (kind === 'project') {
      await selectProject(projectId)
    }
  }

  const selectResourceFromNavigation = async (projectId: string, resourceId: string): Promise<void> => {
    await selectProject(projectId)
    setSelectedResourceId(resourceId)
  }

  const createProject = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const title = newProjectTitle.trim()

    if (!title) {
      return
    }

    const input: ProjectInput = {
      title,
      description: newProjectDescription,
      type: newProjectType,
      notes: ''
    }
    const project = await window.improvement.createProject(input)

    setProjects((items) => [project, ...items])
    setExpandedProjectIds((items) => new Set([...items, project.id]))
    setNewProjectTitle('')
    setNewProjectDescription('')
    setNewProjectType('general')
    setShowNewProjectForm(false)
    await selectProject(project.id)
  }

  const deleteProject = async (id: string): Promise<void> => {
    const deleteResources = confirm(
      'Delete this project?\n\n' +
      'OK = also permanently delete associated resources (PDFs, transcripts, notes, etc.).\n' +
      'Cancel = keep resources (just unlink from this project).'
    )
    await window.improvement.deleteProject(id, deleteResources)
    await loadProjects()
    if (selectedProjectId === id) {
      setSelectedProjectId('')
      setSelectedResourceId(null)
      setSelectedResourceLinks([])
      setKnowledgeGapSummary(null)
    }
  }

  const saveNotes = (): void => {
    const savedAt = new Date().toISOString()
    window.localStorage.setItem('improvement.notes', notes)
    window.localStorage.setItem('improvement.notesSavedAt', savedAt)
    setLastSavedAt(savedAt)
    if (selectedProjectId) {
      void loadKnowledgeGaps(selectedProjectId, notes)
    }
  }

  const selectPomodoroMode = (mode: PomodoroMode): void => {
    setPomodoroMode(mode)
    setPomodoroSeconds(pomodoroDurations[mode])
    setIsPomodoroRunning(false)
  }

  const resetPomodoro = (): void => {
    setPomodoroSeconds(pomodoroDurations[pomodoroMode])
    setIsPomodoroRunning(false)
  }

  const copyMessage = async (message: MentorMessage): Promise<void> => {
    await navigator.clipboard.writeText(message.content)
    setCopiedMessageId(message.id)
    window.setTimeout(() => setCopiedMessageId(null), 1400)
  }

  const copyResourceContent = async (resource: CapturedResource): Promise<void> => {
    await navigator.clipboard.writeText(resource.content)
    setCopiedResourceId(resource.id)
    window.setTimeout(() => setCopiedResourceId(null), 1400)
  }

  const handleTranscriptCapture = async (event: TranscriptCaptureEvent): Promise<void> => {
    setTranscriptNotice(event)

    if (event.type === 'captured') {
      setMentorError(null)
      const fallbackResource = event.resource ?? resourceFromTranscriptEvent(event)
      if (selectedProjectId && event.resource) {
        await window.improvement.linkResourceToProject(event.resource.id, selectedProjectId)
      }
      await loadCapturedResources(fallbackResource)
      return
    }

    setMentorError(event.reason)
  }

  const captureTranscript = async (): Promise<void> => {
    setMentorError(null)
    setIsCapturingTranscript(true)

    try {
      await handleTranscriptCapture(await window.improvement.captureTranscript())
    } catch {
      const event: TranscriptCaptureEvent = {
        type: 'unavailable',
        capturedAt: new Date().toISOString(),
        title: activeTab?.title || 'Video',
        url: activeTab?.url || '',
        reason: 'Unable to capture the transcript from the current page.'
      }
      await handleTranscriptCapture(event)
    } finally {
      setIsCapturingTranscript(false)
    }
  }

  const sendResourceToGrok = async (resource: CapturedResource): Promise<void> => {
    await sendCaptureToMentor({
      title: resource.title,
      url: resource.url ?? '',
      text:
        resource.type === 'transcript'
          ? `Video transcript captured manually.\n\n${resource.content}`
          : `Captured ${resource.type} resource from ${resource.source}.\n\n${resource.content}`
    })
  }

  const deleteResource = async (resourceId: string): Promise<void> => {
    const deleteFile = confirm(
      'Delete this resource from the library?\n\n' +
      'OK = also permanently delete the file from disk (PDFs only).\n' +
      'Cancel = remove from database and project links but keep the file.'
    )
    await window.improvement.deleteCapturedResource(resourceId, deleteFile)
    await loadCapturedResources()
    setProjectResourcesByProject((items) =>
      Object.fromEntries(
        Object.entries(items).map(([projectId, resources]) => [
          projectId,
          resources.filter((resource) => resource.id !== resourceId)
        ])
      )
    )
  }

  const openPdfInBrowser = async (resource: CapturedResource): Promise<void> => {
    try {
      setSnapshot(await window.improvement.openPdfResource(resource.id))
    } catch {
      setMentorError('Unable to open this PDF in the browser.')
    }
  }

  const linkResourceToProjectFromTree = async (resourceId: string, projectId: string): Promise<void> => {
    if (!resourceId || !projectId) {
      return
    }

    setSelectedResourceLinks(await window.improvement.linkResourceToProject(resourceId, projectId))
    setExpandedProjectIds((items) => new Set([...items, projectId]))
    await selectProject(projectId)
    await loadProjectResources(projectId)
    await loadKnowledgeGaps(projectId)
    setSelectedResourceId(resourceId)
  }

  const linkSelectedResourceToProjectId = async (projectId: string): Promise<void> => {
    if (!selectedResource || !projectId) {
      return
    }

    setSelectedResourceLinks(await window.improvement.linkResourceToProject(selectedResource.id, projectId))
    if (projectId === selectedProjectId) {
      await loadProjectResources(projectId)
      await loadKnowledgeGaps(projectId)
    }
  }

  const unlinkSelectedResourceFromProject = async (projectId: string): Promise<void> => {
    if (!selectedResource) {
      return
    }

    setSelectedResourceLinks(await window.improvement.unlinkResourceFromProject(selectedResource.id, projectId))
    if (selectedProjectId) {
      const resources = await loadProjectResources(selectedProjectId)
      await loadKnowledgeGaps(selectedProjectId)
      if (!resources.some((resource) => resource.id === selectedResource.id)) {
        setSelectedResourceId(null)
      }
    }
  }

  const sendCaptureToMentor = async (selection: CapturedSelection): Promise<void> => {
    setMentorError(null)
    setRagStatus('idle')
    setRagResources([])
    setMentorMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: selection.text,
        source: {
          title: selection.title || formatHostname(selection.url),
          url: selection.url
        },
        status: 'complete'
      }
    ])

    try {
      await window.improvement.sendCaptureToMentor(selection)
    } catch {
      setMentorError('Unable to send the selected text to the main process.')
    }
  }

  const sendFollowUp = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const message = followUp.trim()

    if (message.length === 0) {
      return
    }

    setMentorError(null)
    setRagStatus('searching')
    setRagResources([])
    setFollowUp('')
    setMentorMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        status: 'complete'
      }
    ])

    try {
      await window.improvement.sendMentorMessage(message, notes)
    } catch {
      setMentorError('Unable to send the follow-up message to the main process.')
    }
  }

  const askAboutKnowledgeGap = (gap: KnowledgeGapRecommendation): void => {
    setFollowUp(`Help me close this knowledge gap: ${gap.title}. ${gap.recommendation}`)
  }

  const browserPanel = (
    <section className="browser-column" aria-label="Browser content region">
      <section className="tab-strip" aria-label="Browser tabs">
        {snapshot.tabs.map((tab) => (
          <button
            className={tab.id === snapshot.activeTabId ? 'tab active' : 'tab'}
            type="button"
            key={tab.id}
            onClick={() => window.improvement.switchTab(tab.id)}
            title={tab.title}
          >
            <span className={tab.isLoading ? 'tab-dot loading' : 'tab-dot'} />
            <span className="tab-title">{tab.title || formatHostname(tab.url)}</span>
            <span
              role="button"
              tabIndex={0}
              className="tab-close"
              aria-label={`Close ${tab.title || 'tab'}`}
              onClick={(event) => {
                event.stopPropagation()
                closeTab(tab.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  closeTab(tab.id)
                }
              }}
            >
              x
            </span>
          </button>
        ))}
        <button type="button" className="new-tab" onClick={createTab} aria-label="Open new tab">
          +
        </button>
      </section>

      <div className="browser-toolbar">
        <div className="nav-buttons" aria-label="Browser navigation">
          <button type="button" onClick={() => window.improvement.goBack()} disabled={!activeTab?.canGoBack}>
            Back
          </button>
          <button type="button" onClick={() => window.improvement.goForward()} disabled={!activeTab?.canGoForward}>
            Forward
          </button>
          <button type="button" onClick={() => window.improvement.reload()} disabled={!activeTab}>
            Reload
          </button>
        </div>

        <form className="address-form" onSubmit={submitNavigation}>
          <input
            aria-label="URL or search"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Enter a URL or search topic"
          />
          <button type="submit">Go</button>
        </form>
        {canCaptureTranscript && (
          <button type="button" className="capture-transcript-button" onClick={() => void captureTranscript()} disabled={isCapturingTranscript}>
            {isCapturingTranscript ? 'Capturing...' : 'Capture Transcript'}
          </button>
        )}
      </div>
      <div ref={browserFrameRef} className="browser-frame">
        {!activeTab && <div className="browser-empty">Creating your first browser tab...</div>}
      </div>
    </section>
  )

  return (
    <main className="app-shell">
      <PanelGroup
        className="workspace"
        orientation="horizontal"
        id="improvement-workspace"
        disabled={import.meta.env.MODE === 'test'}
        onLayoutChange={scheduleBrowserBoundsUpdate}
      >
        <Panel
          id="left-sidebar-panel"
          className="workspace-panel"
          defaultSize={21}
          minSize="260px"
          maxSize="420px"
          groupResizeBehavior="preserve-pixel-size"
        >
          <aside className="sidebar left project-sidebar">
          <div className="panel-content navigation-panel">
            <div className="left-mode-switch" aria-label="Left sidebar mode">
              <button type="button" className={leftMode === 'projects' ? 'active' : ''} onClick={() => setLeftMode('projects')}>
                Projects
              </button>
              <button type="button" className={leftMode === 'schedule' ? 'active' : ''} onClick={() => setLeftMode('schedule')}>
                Schedule
              </button>
            </div>

            {leftMode === 'projects' ? (
              <section className="project-tree-panel">
                <p className="eyebrow">Projects</p>
                <h2>Learning map</h2>
                <button
                  type="button"
                  className="new-project-button"
                  onClick={() => {
                    if (showNewProjectForm) {
                      setNewProjectTitle('')
                      setNewProjectDescription('')
                      setNewProjectType('general')
                    }
                    setShowNewProjectForm((value) => !value)
                  }}
                >
                  {showNewProjectForm ? 'Cancel' : 'New Project'}
                </button>
                {showNewProjectForm && (
                  <form className="new-project-form" onSubmit={createProject}>
                    <input
                      value={newProjectTitle}
                      onChange={(event) => setNewProjectTitle(event.target.value)}
                      placeholder="Project title"
                      required
                    />
                    <textarea
                      value={newProjectDescription}
                      onChange={(event) => setNewProjectDescription(event.target.value)}
                      placeholder="Description (optional)"
                    />
                    <select
                      value={newProjectType}
                      onChange={(event) => setNewProjectType(event.target.value as 'course' | 'build' | 'skill' | 'general')}
                    >
                      <option value="general">General</option>
                      <option value="course">Course</option>
                      <option value="build">Build</option>
                      <option value="skill">Skill</option>
                    </select>
                    <button type="submit" disabled={newProjectTitle.trim().length === 0}>
                      Create Project
                    </button>
                  </form>
                )}
                <div className="project-tree">
                  {projects.length === 0 ? (
                    <p className="tree-empty">No projects yet. Use "New Project" above to get started.</p>
                  ) : (
                    projects.map((project) => {
                      const projectLinkedResources = projectResourcesByProject[project.id] ?? []
                      const availableResources = capturedResources.filter(
                        (resource) => !projectLinkedResources.some((linkedResource) => linkedResource.id === resource.id)
                      )
                      const expanded = expandedProjectIds.has(project.id)

                      return (
                        <div key={project.id} className="project-tree-item">
                          <div className={selectedProjectId === project.id ? 'project-tree-row active' : 'project-tree-row'}>
                            <button type="button" className="tree-toggle" onClick={() => toggleProjectExpanded(project.id)}>
                              {expanded ? '-' : '+'}
                            </button>
                            <button type="button" className="tree-main" onClick={() => void selectProject(project.id)}>
                              <strong>{project.title}</strong>
                              <span>
                                {project.type} · {projectLinkedResources.length}{' '}
                                {projectLinkedResources.length === 1 ? 'resource' : 'resources'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="tree-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                void deleteProject(project.id)
                              }}
                              title="Delete project"
                            >
                              ×
                            </button>
                          </div>
                          {expanded && (
                            <div className="project-tree-children">
                              <span className="tree-section-label">Resources</span>
                              {projectLinkedResources.length === 0 ? (
                                <span className="tree-empty">No resources linked yet</span>
                              ) : (
                                projectLinkedResources.map((resource) => (
                                  <div
                                    key={resource.id}
                                    className={selectedResourceId === resource.id ? 'resource-tree-row active' : 'resource-tree-row'}
                                  >
                                    <button
                                      type="button"
                                      className="resource-tree-main"
                                      onClick={() => void selectResourceFromNavigation(project.id, resource.id)}
                                    >
                                      <span className="resource-icon">{resourceIcon(resource.type)}</span>
                                      <span>
                                        <strong>{resource.title || 'Captured resource'}</strong>
                                        <small>
                                          {resource.type} · {resource.source} · {formatResourceDate(resource.capturedAt)}
                                        </small>
                                      </span>
                                    </button>
                                    {selectedResourceId === resource.id && selectedResource && (
                                      <div className="resource-tree-actions">
                                        {resource.type === 'pdf' && (
                                          <button type="button" onClick={() => void openPdfInBrowser(resource)}>
                                            Open PDF
                                          </button>
                                        )}
                                        <button type="button" onClick={() => void copyResourceContent(resource)}>
                                          {copiedResourceId === resource.id
                                            ? 'Copied'
                                            : resource.type === 'transcript'
                                              ? 'Copy full transcript'
                                              : 'Copy resource'}
                                        </button>
                                        <button type="button" onClick={() => void sendResourceToGrok(resource)}>
                                          Send to Grok
                                        </button>
                                        <button type="button" onClick={() => void unlinkSelectedResourceFromProject(project.id)}>
                                          Remove
                                        </button>
                                        <button type="button" onClick={() => void deleteResource(resource.id)}>
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                              {availableResources.length > 0 && (
                                <select
                                  className="resource-attach-select"
                                  aria-label={`Attach captured resource to ${project.title}`}
                                  value=""
                                  onChange={(event) => {
                                    void linkResourceToProjectFromTree(event.target.value, project.id)
                                    event.currentTarget.value = ''
                                  }}
                                >
                                  <option value="">Attach captured resource...</option>
                                  {availableResources.map((resource) => (
                                    <option key={resource.id} value={resource.id}>
                                      {resource.title || 'Captured resource'}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            ) : (
              <section className="schedule-panel">
                <p className="eyebrow">Schedule</p>
                <h2>Today</h2>
                <div className="schedule-grid">
                  {scheduleSlots.map((slot) => (
                    <label key={slot} className="time-block">
                      <span>{slot}</span>
                      <select value={scheduleAssignments[slot] ?? ''} onChange={(event) => void handleScheduleAssignment(slot, event.target.value)}>
                        <option value="">Unassigned</option>
                        {projects.map((project) => (
                          <optgroup key={project.id} label={project.title}>
                            <option value={`project:${project.id}`}>{project.title}</option>
                          </optgroup>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>
          </aside>
        </Panel>

        <PanelResizeHandle className="panel-resize-handle" aria-label="Resize left sidebar" />

        <Panel id="learning-workspace-panel" className="workspace-panel" defaultSize={37} minSize="420px">
          <section className="learning-center" aria-label="Learning Workspace">
          <div className="panel-content learning-workspace">
              {transcriptNotice && (
                <section className={transcriptNotice.type === 'captured' ? 'transcript-card success' : 'transcript-card warning'}>
                  <div>
                    <strong>{transcriptNotice.type === 'captured' ? 'Transcript captured' : 'Transcript unavailable'}</strong>
                    <span>
                      {transcriptNotice.type === 'captured'
                        ? `${transcriptNotice.capture.title} · ${formatHostname(transcriptNotice.capture.url)}`
                        : `${transcriptNotice.title} · ${formatHostname(transcriptNotice.url)}`}
                    </span>
                  </div>
                  <p>
                    {transcriptNotice.type === 'captured'
                      ? 'The transcript is ready in the workspace. Review it, then send it to Grok when you are ready.'
                      : transcriptNotice.reason}
                  </p>
                </section>
              )}

              <section className="pomodoro-card" aria-label="Pomodoro timer">
                <div className="card-header">
                  <div>
                    <h3>Pomodoro</h3>
                    <span>{pomodoroMode === 'focus' ? 'Focus session' : 'Short break'}</span>
                  </div>
                </div>
                <div className="pomodoro-display" aria-live="polite">{pomodoroTime}</div>
                <div className="pomodoro-mode-switch" aria-label="Pomodoro mode">
                  <button
                    type="button"
                    className={pomodoroMode === 'focus' ? 'active' : ''}
                    onClick={() => selectPomodoroMode('focus')}
                  >
                    Focus
                  </button>
                  <button
                    type="button"
                    className={pomodoroMode === 'break' ? 'active' : ''}
                    onClick={() => selectPomodoroMode('break')}
                  >
                    Break
                  </button>
                </div>
                <div className="pomodoro-actions">
                  <button type="button" onClick={() => setIsPomodoroRunning((running) => !running)}>
                    {isPomodoroRunning ? 'Pause' : 'Start'}
                  </button>
                  <button type="button" onClick={resetPomodoro}>
                    Reset
                  </button>
                </div>
              </section>

              <section className="notes-card">
                <div className="card-header">
                  <div>
                    <h3>Session notes</h3>
                    <span>{formatSavedTime(lastSavedAt)}</span>
                  </div>
                  <button type="button" onClick={saveNotes}>
                    Save
                  </button>
                </div>
                <textarea
                  className="notes-editor"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Write your takeaways, open questions, formulas, build notes, or ideas to revisit..."
                />
              </section>

              <section className="knowledge-gap-card" aria-label="Knowledge gaps">
                <div className="card-header">
                  <div>
                    <h3>Recommended next</h3>
                    <span>
                      {selectedProject
                        ? `${selectedProject.title} · ${selectedKnowledgeGapSummary?.resourceCount ?? 0} linked ${selectedKnowledgeGapSummary?.resourceCount === 1 ? 'resource' : 'resources'}`
                        : 'Select a project'}
                    </span>
                  </div>
                  <button type="button" disabled={!selectedProject || isLoadingKnowledgeGaps} onClick={() => void loadKnowledgeGaps(selectedProjectId)}>
                    Refresh
                  </button>
                </div>
                {!selectedProject ? (
                  <p className="knowledge-gap-empty">Choose a project to see the next useful gaps.</p>
                ) : isLoadingKnowledgeGaps ? (
                  <p className="knowledge-gap-empty">Analyzing project coverage...</p>
                ) : selectedKnowledgeGaps.length === 0 ? (
                  <p className="knowledge-gap-empty">No obvious gaps detected for this project right now.</p>
                ) : (
                  <div className="knowledge-gap-list">
                    {selectedKnowledgeGaps.map((gap) => (
                      <article key={gap.id} className={`knowledge-gap-item severity-${gap.severity}`}>
                        <div>
                          <strong>{gap.title}</strong>
                          <span>{gap.description}</span>
                        </div>
                        <p>{gap.recommendation}</p>
                        <div className="knowledge-gap-footer">
                          <span>Severity {gap.severity}</span>
                          <button type="button" onClick={() => askAboutKnowledgeGap(gap)}>
                            Ask Grok
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="learning-actions-card">
                <div className="card-header">
                  <div>
                    <h3>Learning cells</h3>
                    <span>Prompt starters for turning resources into practice.</span>
                  </div>
                </div>
                <div className="learning-action-grid">
                  <button type="button" onClick={() => setFollowUp('Explain this at my current technical level.')}>
                    Explain
                    <span>Clarify the concept</span>
                  </button>
                  <button type="button" onClick={() => setFollowUp('Create a simple visualization or diagram plan for this.')}>
                    Visualize
                    <span>Sketch the idea</span>
                  </button>
                  <button type="button" onClick={() => setFollowUp('Give me a hands-on practice exercise for this topic.')}>
                    Practice
                    <span>Apply it in the shop</span>
                  </button>
                  <button type="button" onClick={() => setFollowUp('Quiz me on the important details and assumptions.')}>
                    Quiz
                    <span>Check retention</span>
                  </button>
                </div>
              </section>

              <section className="mentor-panel">
                <div className="mentor-header">
                  <div>
                    <h3>Grok mentor</h3>
                    <span>
                      {xaiStatus?.hasApiKey
                        ? `Using ${xaiStatus.model} from ${xaiStatus.source}`
                        : 'No xAI API key configured'}
                    </span>
                  </div>
                  {isMentorStreaming && <span className="streaming-pill">Streaming</span>}
                </div>

                {!xaiStatus?.hasApiKey && (
                  <form className="api-key-form" onSubmit={saveTemporaryApiKey}>
                    <label htmlFor="xai-api-key">Temporary xAI API key</label>
                    <div>
                      <input
                        id="xai-api-key"
                        type="password"
                        value={temporaryApiKey}
                        onChange={(event) => setTemporaryApiKey(event.target.value)}
                        placeholder="xai-..."
                      />
                      <button type="submit" disabled={temporaryApiKey.trim().length === 0}>
                        Use Key
                      </button>
                    </div>
                    <p>The key is sent to the main process and kept in memory for this app session only.</p>
                  </form>
                )}

                {mentorError && <div className="mentor-error">{mentorError}</div>}

                {ragStatus !== 'idle' && (
                  <div className="rag-context-card">
                    <strong>
                      {ragStatus === 'searching'
                        ? 'Searching your knowledge base...'
                        : ragResources.length > 0
                          ? `Using ${ragResources.length} relevant ${ragResources.length === 1 ? 'resource' : 'resources'}`
                          : 'No local resources matched this question'}
                    </strong>
                    {ragResources.length > 0 && (
                      <span>{ragResources.map((resource) => resource.title).join(' · ')}</span>
                    )}
                  </div>
                )}

                <div className="mentor-messages" aria-live="polite">
                  {mentorMessages.length === 0 ? (
                    <p className="empty-chat">Select text on a webpage and click &quot;Send to AI&quot;, or ask a question below.</p>
                  ) : (
                    mentorMessages.map((message) => (
                      <article
                        key={message.id}
                        className={
                          message.role === 'assistant'
                            ? `mentor-message assistant ${message.status ?? ''}`
                            : 'mentor-message user'
                        }
                      >
                        <div className="message-header">
                          <strong>{message.role === 'assistant' ? 'Grok' : 'You'}</strong>
                          {message.role === 'assistant' && message.content.length > 0 && (
                            <button type="button" onClick={() => void copyMessage(message)}>
                              {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                            </button>
                          )}
                        </div>
                        {message.source && (
                          <span className="message-source">
                            {message.source.title} · {formatHostname(message.source.url)}
                          </span>
                        )}
                        {message.role === 'assistant' ? (
                          <FormattedMentorContent content={message.content} />
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <form className="follow-up-form" onSubmit={sendFollowUp}>
                  <input
                    value={followUp}
                    onChange={(event) => setFollowUp(event.target.value)}
                    placeholder="Ask a follow-up..."
                    disabled={isMentorStreaming}
                  />
                  <button type="submit" disabled={isMentorStreaming || followUp.trim().length === 0}>
                    Send
                  </button>
                </form>
              </section>

              <div className="visualizer-card">
                <div className="card-header">
                  <div>
                    <h3>Visualizer</h3>
                    <span>Coming soon</span>
                  </div>
                </div>
                <div className="visualizer-preview">
                  <div className="axis horizontal" />
                  <div className="axis vertical" />
                  <div className="curve" />
                  <div className="point one" />
                  <div className="point two" />
                </div>
                <strong>Future diagrams, charts, and fabrication previews will appear here.</strong>
                <p>Use this space for geometry sketches, process flows, force diagrams, and AI-generated explanations tied to your notes.</p>
              </div>
          </div>
          </section>
        </Panel>

        <PanelResizeHandle className="panel-resize-handle" aria-label="Resize browser panel" />

        <Panel id="browser-workspace-panel" className="workspace-panel" defaultSize={37} minSize="390px">
          {browserPanel}
        </Panel>
      </PanelGroup>
    </main>
  )
}
