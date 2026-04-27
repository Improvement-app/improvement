import type { FormEvent, ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  BrowserTab,
  CapturedSelection,
  MentorMessage,
  RagResourceReference,
  TabsSnapshot,
  TranscriptCaptureEvent,
  XaiStatus
} from '../../shared/ipc'
import type {
  LearningGoal,
  LearningGoalInput,
  LearningGoalStatus,
  Project,
  ProjectInput,
  ProjectProgress,
  ProjectResourceLink,
  ProjectType
} from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'

const initialSnapshot: TabsSnapshot = {
  tabs: [],
  activeTabId: null
}

type LeftSidebarMode = 'projects' | 'schedule'

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

function goalStatusLabel(status: LearningGoalStatus): string {
  if (status === 'in-progress') return 'In Progress'
  if (status === 'done') return 'Done'
  return 'Todo'
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

interface TranscriptSegment {
  timestamp: string
  text: string
}

function parseTranscriptSegments(content: string): TranscriptSegment[] {
  const timestampPattern = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-\s*)?/g
  const matches = [...content.matchAll(timestampPattern)]

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = matches[index + 1]?.index ?? content.length
      const text = content.slice(start, end).replace(/\s+/g, ' ').trim()

      return {
        timestamp: match[1],
        text
      }
    })
    .filter((segment) => segment.text.length > 0)
}

function cleanTranscriptText(content: string): string {
  return content
    .replace(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?\s*(?:-\s*)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function transcriptParagraphs(content: string): string[] {
  const segments = parseTranscriptSegments(content)

  if (segments.length === 0) {
    return content
      .split(/\n{2,}/)
      .map((paragraph) => cleanTranscriptText(paragraph))
      .filter(Boolean)
  }

  const paragraphs: string[] = []
  let current = ''

  for (const segment of segments) {
    current = `${current} ${segment.text}`.trim()

    if (current.length >= 260 && /[.!?]"?$/.test(segment.text)) {
      paragraphs.push(current)
      current = ''
    }
  }

  if (current) {
    paragraphs.push(current)
  }

  return paragraphs.length > 0 ? paragraphs : [cleanTranscriptText(content)].filter(Boolean)
}

function TranscriptResourcePreview({
  resource,
  showTimestamps
}: {
  resource: CapturedResource
  showTimestamps: boolean
}): ReactElement {
  const segments = parseTranscriptSegments(resource.content)
  const paragraphs = transcriptParagraphs(resource.content)

  if (showTimestamps && segments.length > 0) {
    return (
      <div className="transcript-readable timestamped">
        {segments.map((segment, index) => (
          <p key={`${segment.timestamp}-${index}`} className="transcript-line">
            <span className="transcript-timestamp">{segment.timestamp}</span>
            <span>{segment.text}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="transcript-readable">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
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
  const [projectResources, setProjectResources] = useState<CapturedResource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [goalsByProject, setGoalsByProject] = useState<Record<string, LearningGoal[]>>({})
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [learningGoals, setLearningGoals] = useState<LearningGoal[]>([])
  const [projectProgress, setProjectProgress] = useState<ProjectProgress | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedResourceLinks, setSelectedResourceLinks] = useState<ProjectResourceLink[]>([])
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectType, setNewProjectType] = useState<'course' | 'build' | 'skill' | 'general'>('general')
  const [showNewGoalForm, setShowNewGoalForm] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  const [goalPriority, setGoalPriority] = useState(3)
  const [showTranscriptTimestamps, setShowTranscriptTimestamps] = useState(false)
  const [isCapturingTranscript, setIsCapturingTranscript] = useState(false)

  const activeTab = useMemo(() => activeTabFrom(snapshot), [snapshot])
  const canCaptureTranscript = Boolean(activeTab && (isYouTubeWatchPage(activeTab.url) || isHPAcademyVideoPage(activeTab.url)))
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedGoal = useMemo(
    () => learningGoals.find((goal) => goal.id === selectedGoalId) ?? null,
    [learningGoals, selectedGoalId]
  )
  const displayedResources = selectedProject ? projectResources : capturedResources
  const selectedResource = useMemo(
    () => displayedResources.find((resource) => resource.id === selectedResourceId) ?? displayedResources[0] ?? null,
    [displayedResources, selectedResourceId]
  )

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

    return () => {
      disposeTabs()
      disposeSelections()
      disposeMentorStream()
    }
  }, [])

  const loadCapturedResources = async (fallback?: CapturedResource): Promise<void> => {
    try {
      const resources = await window.improvement.getCapturedResources()
      const nextResources = resources.length > 0 || !fallback ? resources : [fallback]
      let nextProjectResources: CapturedResource[] = []
      setCapturedResources(nextResources)
      if (selectedProjectId) {
        nextProjectResources = await window.improvement.getProjectResources(selectedProjectId)
        setProjectResources(nextProjectResources)
      }
      const visibleResources = selectedProjectId ? nextProjectResources : nextResources
      setSelectedResourceId((currentId) =>
        currentId && visibleResources.some((resource) => resource.id === currentId)
          ? currentId
          : visibleResources[0]?.id ?? null
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
      const goalEntries = await Promise.all(
        nextProjects.map(async (project) => [project.id, await window.improvement.getLearningGoals(project.id)] as const)
      )
      setProjects(nextProjects)
      setGoalsByProject(Object.fromEntries(goalEntries))
      setExpandedProjectIds((expandedIds) => new Set([...expandedIds, ...nextProjects.map((project) => project.id)]))
    } catch {
      setMentorError('Unable to load projects.')
    }
  }

  const loadProjectResources = async (projectId: string): Promise<CapturedResource[]> => {
    if (!projectId) {
      setProjectResources([])
      return []
    }

    const resources = await window.improvement.getProjectResources(projectId)
    setProjectResources(resources)
    return resources
  }

  const loadLearningGoals = async (projectId: string): Promise<LearningGoal[]> => {
    if (!projectId) {
      setLearningGoals([])
      setProjectProgress(null)
      setSelectedGoalId('')
      return []
    }

    const [goals, progress] = await Promise.all([
      window.improvement.getLearningGoals(projectId),
      window.improvement.getProjectProgress(projectId)
    ])
    setLearningGoals(goals)
    setGoalsByProject((items) => ({ ...items, [projectId]: goals }))
    setProjectProgress(progress)
    setSelectedGoalId((currentId) =>
      currentId && goals.some((goal) => goal.id === currentId)
        ? currentId
        : goals.find((goal) => goal.status !== 'done')?.id ?? goals[0]?.id ?? ''
    )
    return goals
  }

  const loadProjectWorkspace = async (projectId: string): Promise<CapturedResource[]> => {
    const [resources] = await Promise.all([loadProjectResources(projectId), loadLearningGoals(projectId)])
    return resources
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
    const frame = browserFrameRef.current

    if (!frame) {
      return
    }

    const updateBounds = (): void => {
      const rect = frame.getBoundingClientRect()
      window.improvement.setBrowserBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
    }

    updateBounds()

    const observer = new ResizeObserver(updateBounds)
    observer.observe(frame)
    window.addEventListener('resize', updateBounds)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBounds)
    }
  }, [snapshot.activeTabId])

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
      setProjectResources([])
      setLearningGoals([])
      setProjectProgress(null)
      setSelectedGoalId('')
      setSelectedResourceId(capturedResources[0]?.id ?? null)
      return
    }

    const resources = await loadProjectWorkspace(projectId)
    setSelectedResourceId(resources[0]?.id ?? null)
  }

  const selectGoalFromNavigation = async (goal: LearningGoal): Promise<void> => {
    await selectProject(goal.projectId)
    setSelectedGoalId(goal.id)
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

    const [kind, projectId, goalId] = value.split(':')
    if (kind === 'project') {
      await selectProject(projectId)
      return
    }

    const goal = goalsByProject[projectId]?.find((item) => item.id === goalId)
    if (goal) {
      await selectGoalFromNavigation(goal)
    }
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
    setGoalsByProject((items) => ({ ...items, [project.id]: [] }))
    setExpandedProjectIds((items) => new Set([...items, project.id]))
    setNewProjectTitle('')
    setNewProjectDescription('')
    setNewProjectType('general')
    setShowNewProjectForm(false)
    await selectProject(project.id)
  }

  const resetGoalForm = (): void => {
    setEditingGoalId(null)
    setGoalTitle('')
    setGoalDescription('')
    setGoalPriority(3)
  }

  const startEditingGoal = (goal: LearningGoal): void => {
    setShowNewGoalForm(false)
    setEditingGoalId(goal.id)
    setGoalTitle(goal.title)
    setGoalDescription(goal.description)
    setGoalPriority(goal.priority)
  }

  const saveGoal = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!selectedProjectId || goalTitle.trim().length === 0) {
      return
    }

    let createdGoalId = ''
    if (editingGoalId) {
      await window.improvement.updateLearningGoal({
        id: editingGoalId,
        title: goalTitle,
        description: goalDescription,
        priority: goalPriority
      })
    } else {
      const input: LearningGoalInput = {
        projectId: selectedProjectId,
        title: goalTitle,
        description: goalDescription,
        priority: goalPriority,
        notes: ''
      }
      const goal = await window.improvement.createLearningGoal(input)
      createdGoalId = goal.id
    }

    resetGoalForm()
    setShowNewGoalForm(false)
    await loadLearningGoals(selectedProjectId)
    if (createdGoalId) {
      setSelectedGoalId(createdGoalId)
    }
  }

  const updateGoalStatus = async (goal: LearningGoal, status: LearningGoalStatus): Promise<void> => {
    await window.improvement.updateLearningGoal({ id: goal.id, status })
    await loadLearningGoals(goal.projectId)
  }

  const deleteGoal = async (goal: LearningGoal): Promise<void> => {
    await window.improvement.deleteLearningGoal(goal.id)
    await loadLearningGoals(goal.projectId)
  }

  const saveNotes = (): void => {
    const savedAt = new Date().toISOString()
    window.localStorage.setItem('improvement.notes', notes)
    window.localStorage.setItem('improvement.notesSavedAt', savedAt)
    setLastSavedAt(savedAt)
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
        await window.improvement.linkResourceToProject(event.resource.id, selectedProjectId, selectedGoalId || undefined)
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
    await window.improvement.deleteCapturedResource(resourceId)
    await loadCapturedResources()
  }

  const openPdfInBrowser = async (resource: CapturedResource): Promise<void> => {
    try {
      setSnapshot(await window.improvement.openPdfResource(resource.id))
    } catch {
      setMentorError('Unable to open this PDF in the browser.')
    }
  }

  const isSelectedResourceLinkedToProject = Boolean(
    selectedProjectId && selectedResourceLinks.some((link) => link.projectId === selectedProjectId)
  )

  const linkSelectedResourceToProject = async (): Promise<void> => {
    if (!selectedResource || !selectedProjectId) {
      return
    }

    setSelectedResourceLinks(await window.improvement.linkResourceToProject(selectedResource.id, selectedProjectId, selectedGoalId || undefined))
    await loadProjectResources(selectedProjectId)
  }

  const linkSelectedResourceToProjectId = async (projectId: string, goalId?: string | null): Promise<void> => {
    if (!selectedResource || !projectId) {
      return
    }

    setSelectedResourceLinks(await window.improvement.linkResourceToProject(selectedResource.id, projectId, goalId))
    if (projectId === selectedProjectId) {
      await loadProjectResources(projectId)
    }
  }

  const unlinkSelectedResourceFromProject = async (projectId: string): Promise<void> => {
    if (!selectedResource) {
      return
    }

    setSelectedResourceLinks(await window.improvement.unlinkResourceFromProject(selectedResource.id, projectId))
    if (selectedProjectId) {
      const resources = await loadProjectResources(selectedProjectId)
      if (!resources.some((resource) => resource.id === selectedResource.id)) {
        setSelectedResourceId(resources[0]?.id ?? null)
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
      await window.improvement.sendMentorMessage(message)
    } catch {
      setMentorError('Unable to send the follow-up message to the main process.')
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
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
                  onClick={() => setShowNewProjectForm((value) => !value)}
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
                    <p className="empty-goals">No projects yet. Use "New Project" above to get started.</p>
                  ) : (
                    projects.map((project) => {
                      const projectGoals = goalsByProject[project.id] ?? []
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
                                {project.type} · {projectGoals.length} {projectGoals.length === 1 ? 'goal' : 'goals'}
                              </span>
                            </button>
                          </div>
                          {expanded && (
                            <div className="goal-tree-list">
                              {projectGoals.length === 0 ? (
                                <span className="tree-empty">No goals yet</span>
                              ) : (
                                projectGoals.map((goal) => (
                                  <button
                                    type="button"
                                    key={goal.id}
                                    className={selectedGoalId === goal.id ? 'goal-tree-row active' : 'goal-tree-row'}
                                    onClick={() => void selectGoalFromNavigation(goal)}
                                  >
                                    <span className={`goal-status ${goal.status}`}>{goalStatusLabel(goal.status)}</span>
                                    <strong>{goal.title}</strong>
                                  </button>
                                ))
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
                            {(goalsByProject[project.id] ?? []).map((goal) => (
                              <option key={goal.id} value={`goal:${project.id}:${goal.id}`}>
                                {goal.title}
                              </option>
                            ))}
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

              {selectedProject && (
                <section className="goals-card">
                  <div className="card-header">
                    <div>
                      <h3>Goals</h3>
                      <span>Pick the next objective and keep project progress visible.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetGoalForm()
                        setShowNewGoalForm((value) => !value)
                      }}
                    >
                      {showNewGoalForm ? 'Cancel' : 'New Goal'}
                    </button>
                  </div>

                  {learningGoals.length > 0 && (
                    <label className="project-selector">
                      <span>Active goal for new resources</span>
                      <select value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)}>
                        <option value="">No active goal</option>
                        {learningGoals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {(showNewGoalForm || editingGoalId) && (
                    <form className="new-project-form" onSubmit={saveGoal}>
                      <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Goal title" />
                      <textarea
                        value={goalDescription}
                        onChange={(event) => setGoalDescription(event.target.value)}
                        placeholder="What should this goal help you understand or do?"
                      />
                      <select value={goalPriority} onChange={(event) => setGoalPriority(Number(event.target.value))}>
                        <option value={1}>Priority 1</option>
                        <option value={2}>Priority 2</option>
                        <option value={3}>Priority 3</option>
                        <option value={4}>Priority 4</option>
                        <option value={5}>Priority 5</option>
                      </select>
                      <button type="submit" disabled={goalTitle.trim().length === 0}>
                        {editingGoalId ? 'Save Goal' : 'Create Goal'}
                      </button>
                    </form>
                  )}

                  <div className="goal-list">
                    {learningGoals.length === 0 ? (
                      <p className="empty-goals">No goals yet. Add one clear next objective for this project.</p>
                    ) : (
                      learningGoals.map((goal) => (
                        <article key={goal.id} className={selectedGoalId === goal.id ? 'goal-row active' : 'goal-row'}>
                          <div>
                            <strong>{goal.title}</strong>
                            {goal.description && <span>{goal.description}</span>}
                            <small>Priority {goal.priority}</small>
                          </div>
                          <div className="goal-actions">
                            <span className={`goal-status ${goal.status}`}>{goalStatusLabel(goal.status)}</span>
                            <select
                              aria-label={`Change status for ${goal.title}`}
                              value={goal.status}
                              onChange={(event) => void updateGoalStatus(goal, event.target.value as LearningGoalStatus)}
                            >
                              <option value="todo">Todo</option>
                              <option value="in-progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>
                            <button type="button" onClick={() => setSelectedGoalId(goal.id)}>
                              Use
                            </button>
                            <button type="button" onClick={() => startEditingGoal(goal)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => void deleteGoal(goal)}>
                              Delete
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              )}

              {displayedResources.length > 0 && (
                <section className="captured-transcripts-card resource-library-card">
                  <div className="card-header">
                    <div>
                      <h3>{selectedProject ? 'Project resources' : 'Captured resources'}</h3>
                      <span>
                        {displayedResources.length} {selectedProject ? 'linked' : 'saved locally'}
                      </span>
                    </div>
                  </div>
                  <div className="resource-list">
                    {displayedResources.map((resource) => (
                      <button
                        type="button"
                        key={resource.id}
                        className={selectedResource?.id === resource.id ? 'resource-row active' : 'resource-row'}
                        onClick={() => setSelectedResourceId(resource.id)}
                      >
                        <span className="resource-icon">{resourceIcon(resource.type)}</span>
                        <span>
                          <strong>{resource.title || 'Captured resource'}</strong>
                          <small>
                            {resource.type} · {resource.source} · {formatResourceDate(resource.capturedAt)}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedResource && (
                    <article className="captured-transcript resource-preview">
                      <div className="message-header resource-preview-header">
                        <div>
                          <strong>{selectedResource.title || 'Captured resource'}</strong>
                          <span>
                            {selectedResource.type} · {selectedResource.url ? formatHostname(selectedResource.url) : selectedResource.source}
                          </span>
                          {selectedResourceLinks.length > 0 && (
                            <span className="linked-projects">
                              Linked to{' '}
                              {selectedResourceLinks
                                .map((link) =>
                                  link.learningGoal ? `${link.project.title} / ${link.learningGoal.title}` : link.project.title
                                )
                                .join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="resource-actions">
                          {!selectedProjectId && projects.length > 0 && (
                            <select
                              aria-label="Link selected resource to project"
                              defaultValue=""
                              onChange={(event) => {
                                void linkSelectedResourceToProjectId(event.target.value)
                                event.currentTarget.value = ''
                              }}
                            >
                              <option value="">Link to project...</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.title}
                                </option>
                              ))}
                            </select>
                          )}
                          {selectedProjectId && (
                            <button
                              type="button"
                              onClick={() =>
                                isSelectedResourceLinkedToProject
                                  ? void unlinkSelectedResourceFromProject(selectedProjectId)
                                  : void linkSelectedResourceToProject()
                              }
                            >
                              {isSelectedResourceLinkedToProject ? 'Unlink Project' : 'Link to Project'}
                            </button>
                          )}
                          {selectedProjectId && learningGoals.length > 0 && (
                            <select
                              aria-label="Link selected resource to goal"
                              value={selectedResourceLinks.find((link) => link.projectId === selectedProjectId)?.learningGoalId ?? ''}
                              onChange={(event) =>
                                void linkSelectedResourceToProjectId(selectedProjectId, event.target.value || null)
                              }
                            >
                              <option value="">No goal link</option>
                              {learningGoals.map((goal) => (
                                <option key={goal.id} value={goal.id}>
                                  {goal.title}
                                </option>
                              ))}
                            </select>
                          )}
                          {selectedResource.type === 'pdf' && (
                            <button type="button" onClick={() => void openPdfInBrowser(selectedResource)}>
                              Open PDF in Browser
                            </button>
                          )}
                          {selectedResource.type === 'transcript' && (
                            <button type="button" onClick={() => setShowTranscriptTimestamps((value) => !value)}>
                              {showTranscriptTimestamps ? 'Hide timestamps' : 'Show timestamps'}
                            </button>
                          )}
                          <button type="button" onClick={() => void copyResourceContent(selectedResource)}>
                            {copiedResourceId === selectedResource.id
                              ? 'Copied'
                              : selectedResource.type === 'transcript'
                                ? 'Copy full transcript'
                                : 'Copy resource'}
                          </button>
                          <button type="button" onClick={() => void sendResourceToGrok(selectedResource)}>
                            Send to Grok
                          </button>
                          <button type="button" onClick={() => void deleteResource(selectedResource.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                      {selectedProject && (
                        <button
                          type="button"
                          className="unlink-project-resource"
                          onClick={() => void unlinkSelectedResourceFromProject(selectedProject.id)}
                        >
                          Remove from {selectedProject.title}
                        </button>
                      )}
                      {selectedResource.type === 'transcript' ? (
                        <TranscriptResourcePreview resource={selectedResource} showTimestamps={showTranscriptTimestamps} />
                      ) : (
                        <pre>{selectedResource.content}</pre>
                      )}
                    </article>
                  )}
                </section>
              )}

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
      </section>
    </main>
  )
}
