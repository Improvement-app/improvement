import type { FormEvent, ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BrowserTab, CapturedSelection, MentorMessage, TabsSnapshot, TranscriptCaptureEvent, XaiStatus } from '../../shared/ipc'

const initialSnapshot: TabsSnapshot = {
  tabs: [],
  activeTabId: null
}

function activeTabFrom(snapshot: TabsSnapshot): BrowserTab | null {
  return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? null
}

function formatHostname(url: string): string {
  if (url === 'improvement://new-tab') {
    return 'New Tab'
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatAddress(url: string): string {
  return url === 'improvement://new-tab' ? '' : url
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
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [xaiStatus, setXaiStatus] = useState<XaiStatus | null>(null)
  const [temporaryApiKey, setTemporaryApiKey] = useState('')
  const [mentorMessages, setMentorMessages] = useState<MentorMessage[]>([])
  const [followUp, setFollowUp] = useState('')
  const [mentorError, setMentorError] = useState<string | null>(null)
  const [isMentorStreaming, setIsMentorStreaming] = useState(false)
  const [notes, setNotes] = useState(() => window.localStorage.getItem('improvement.notes') ?? '')
  const [lastSavedAt, setLastSavedAt] = useState(() => window.localStorage.getItem('improvement.notesSavedAt'))
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [transcriptNotice, setTranscriptNotice] = useState<TranscriptCaptureEvent | null>(null)

  const activeTab = useMemo(() => activeTabFrom(snapshot), [snapshot])

  useEffect(() => {
    window.improvement.getXaiStatus().then(setXaiStatus).catch(() => {
      setMentorError('Unable to read xAI API key status from the main process.')
    })

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

    const disposeTranscriptCapture = window.improvement.onTranscriptCapture((event) => {
      void handleTranscriptCapture(event)
    })

    const disposeMentorStream = window.improvement.onMentorStream((event) => {
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
      disposeTranscriptCapture()
      disposeMentorStream()
    }
  }, [])

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
  }, [leftCollapsed, rightCollapsed, snapshot.activeTabId])

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

  const handleTranscriptCapture = async (event: TranscriptCaptureEvent): Promise<void> => {
    setRightCollapsed(false)
    setTranscriptNotice(event)

    if (event.type === 'captured') {
      setMentorError(null)
      await sendCaptureToMentor({
        ...event.capture,
        text: `YouTube transcript captured automatically.\n\n${event.capture.text}`
      })
      return
    }

    setMentorError(event.reason)
  }

  const sendCaptureToMentor = async (selection: CapturedSelection): Promise<void> => {
    setRightCollapsed(false)
    setMentorError(null)
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
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark">I</div>
          <div>
            <strong>Improvement</strong>
            <span>AI mentor workspace</span>
          </div>
        </div>

        <div className="top-bar-status">
          <span>{activeTab ? formatHostname(activeTab.url) : 'Browser starting'}</span>
          <strong>{activeTab?.isLoading ? 'Loading' : 'Ready'}</strong>
        </div>

        <div className="top-bar-actions">
          <button type="button" className="ghost-button" onClick={() => setLeftCollapsed((value) => !value)}>
            {leftCollapsed ? 'Show Tasks' : 'Hide Tasks'}
          </button>
          <button type="button" className="mentor-button" onClick={() => setRightCollapsed(false)}>
            Ask Mentor
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className={leftCollapsed ? 'sidebar left collapsed' : 'sidebar left'}>
          <button type="button" className="collapse-button" onClick={() => setLeftCollapsed((value) => !value)}>
            {leftCollapsed ? 'Tasks' : 'Collapse'}
          </button>
          {!leftCollapsed && (
            <div className="panel-content">
              <p className="eyebrow">Tasks & Schedule</p>
              <h2>Today&apos;s learning plan</h2>
              <ul className="task-list">
                <li>
                  <span className="checkbox" />
                  Study suspension geometry fundamentals
                </li>
                <li>
                  <span className="checkbox" />
                  Capture three chassis design resources
                </li>
                <li>
                  <span className="checkbox" />
                  Draft fabrication questions for the mentor
                </li>
              </ul>
              <div className="schedule-card">
                <span>Next focus block</span>
                <strong>7:30 PM - 8:15 PM</strong>
              </div>
            </div>
          )}
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
          </div>
          <div ref={browserFrameRef} className="browser-frame">
            {!activeTab && <div className="browser-empty">Creating your first browser tab...</div>}
          </div>
        </section>

        <aside className={rightCollapsed ? 'sidebar right collapsed' : 'sidebar right'}>
          <button type="button" className="collapse-button" onClick={() => setRightCollapsed((value) => !value)}>
            {rightCollapsed ? 'Notes' : 'Collapse'}
          </button>
          {!rightCollapsed && (
            <div className="panel-content learning-workspace">
              <div className="workspace-heading">
                <p className="eyebrow">Learning Workspace</p>
                <h2>Notes + Mentor</h2>
                <span>Capture ideas, ask Grok, and turn browsing into retained understanding.</span>
              </div>

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
                      ? 'The YouTube transcript was sent to the Grok mentor workspace automatically.'
                      : transcriptNotice.reason}
                  </p>
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
          )}
        </aside>
      </section>
    </main>
  )
}
