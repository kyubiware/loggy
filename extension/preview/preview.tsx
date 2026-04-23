import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { createRoot } from 'react-dom/client'
import remarkGfm from 'remark-gfm'
import './index.css'

function Preview() {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'rendered' | 'raw'>('rendered')
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const id = searchParams.get('id')

    if (!id) {
      setError('No preview data found. Please try again from the popup.')
      return
    }

    chrome.runtime.sendMessage({ type: 'get-cached-preview', id }, (response: { markdown: string | null } | undefined) => {
      if (!response?.markdown) {
        setError('No preview data found. Please try again from the popup.')
        return
      }
      setMarkdown(response.markdown)
    })
  }, [])

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  const copyToClipboard = useCallback(async () => {
    if (!markdown) {
      return
    }

    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      setCopied(false)
    }
  }, [markdown])

  if (error) {
    return (
      <div className="min-h-screen bg-white text-stone-800 dark:bg-stone-900 dark:text-stone-200">
        <header className="border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h1 className="text-base font-semibold">Markdown Preview</h1>
        </header>
        <main className="p-6">
          <p>{error}</p>
        </main>
      </div>
    )
  }

  if (!markdown) {
    return (
      <div className="min-h-screen bg-white text-stone-800 dark:bg-stone-900 dark:text-stone-200">
        <header className="border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h1 className="text-base font-semibold">Markdown Preview</h1>
        </header>
        <main className="p-6">
          <p>Loading preview...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white text-stone-800 dark:bg-stone-900 dark:text-stone-200">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-4 py-3 dark:border-stone-700">
        <h1 className="text-base font-semibold">Markdown Preview</h1>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-stone-200 p-0.5 dark:border-stone-700">
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm ${
                view === 'rendered'
                  ? 'bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900'
                  : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
              }`}
              onClick={() => setView('rendered')}
            >
              Rendered
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm ${
                view === 'raw'
                  ? 'bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900'
                  : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
              }`}
              onClick={() => setView('raw')}
            >
              Raw
            </button>
          </div>

          <button
            type="button"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            onClick={copyToClipboard}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        {view === 'rendered' ? (
          <div className="prose max-w-none p-6 dark:prose-invert">
            <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap p-6 font-mono text-sm">{markdown}</pre>
        )}
      </main>
    </div>
  )
}

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Preview />
    </StrictMode>,
  )
}
