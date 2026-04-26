import type { FormEvent, ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BrowserTab, CapturedSelection, TabsSnapshot } from '../../shared/ipc'

const initialSnapshot: TabsSnapshot = {
  tabs: [],
  activeTabId: null
}

function activeTabFrom(snapshot: TabsSnapshot): BrowserTab | null {
  return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? null
}

function formatHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function App(): ReactElement {
  const browserFrameRef = useRef<HTMLDivElement | null>(null)
  const [snapshot, setSnapshot] = useState<TabsSnapshot>(initialSnapshot)
  const [address, setAddress] = useState('https://www.wikipedia.org')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [captures, setCaptures] = useState<CapturedSelection[]>([])

  const activeTab = useMemo(() => activeTabFrom(snapshot), [snapshot])

  useEffect(() => {
    const disposeTabs = window.improvement.onTabsChanged((nextSnapshot) => {
      setSnapshot(nextSnapshot)
      const nextActiveTab = activeTabFrom(nextSnapshot)
      if (nextActiveTab) {
        setAddress(nextActiveTab.url)
      }
    })

    const disposeSelections = window.improvement.onSelectionCaptured((selection) => {
      setCaptures((items) => [selection, ...items].slice(0, 8))
    })

    return () => {
      disposeTabs()
      disposeSelections()
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
    setSnapshot(await window.improvement.createTab('https://www.wikipedia.org'))
  }

  const closeTab = async (tabId: string): Promise<void> => {
    setSnapshot(await window.improvement.closeTab(tabId))
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

        <button type="button" className="mentor-button">
          Ask Mentor
        </button>
      </header>

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
        <button type="button" className="new-tab" onClick={createTab}>
          + New Tab
        </button>
      </section>

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
          <div className="browser-toolbar">
            <span>{activeTab ? formatHostname(activeTab.url) : 'Preparing browser'}</span>
            <span>{activeTab?.isLoading ? 'Loading...' : 'Ready'}</span>
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
            <div className="panel-content">
              <p className="eyebrow">Notes + Visualizer</p>
              <h2>Learning workspace</h2>
              <textarea placeholder="Capture your understanding, mentor prompts, and project notes..." />
              <div className="visualizer-card">
                <span>Visualizer placeholder</span>
                <strong>Diagrams, charts, and fabrication previews will appear here.</strong>
              </div>
              <div className="captures">
                <h3>Recent AI captures</h3>
                {captures.length === 0 ? (
                  <p>Select text on a webpage, then click &quot;Send to AI&quot;.</p>
                ) : (
                  captures.map((capture, index) => (
                    <article key={`${capture.url}-${index}`}>
                      <strong>{capture.title || formatHostname(capture.url)}</strong>
                      <p>{capture.text}</p>
                      <span>{formatHostname(capture.url)}</span>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}
