'use client'

import { useState, useRef } from 'react'
import {
  Database,
  Play,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Terminal,
  FileCode,
} from 'lucide-react'

type LogEntry = {
  timestamp: string
  type: 'info' | 'success' | 'error' | 'output' | 'warning'
  message: string
}

type SqlMigrationStatus = {
  applied: string[]
  pending: { id: string; description: string }[]
  total: number
} | null

type SqlMigrationResult = {
  results: { id: string; status: string; error?: string }[]
  summary: { total: number; applied: number; skipped: number; failed: number }
} | null

export default function MigrateClient() {
  const [schemaLogs, setSchemaLogs] = useState<LogEntry[]>([])
  const [sqlLogs, setSqlLogs] = useState<LogEntry[]>([])
  const [isRunningSchema, setIsRunningSchema] = useState(false)
  const [isRunningSql, setIsRunningSql] = useState(false)
  const [isCheckingSql, setIsCheckingSql] = useState(false)
  const [sqlStatus, setSqlStatus] = useState<SqlMigrationStatus>(null)
  const [sqlResult, setSqlResult] = useState<SqlMigrationResult>(null)
  const [acceptDataLoss, setAcceptDataLoss] = useState(false)
  const [copiedSchema, setCopiedSchema] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const schemaOutputRef = useRef<HTMLPreElement>(null)
  const sqlOutputRef = useRef<HTMLPreElement>(null)

  const now = () => new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 })

  const addSchemaLog = (type: LogEntry['type'], message: string) => {
    setSchemaLogs((prev) => [...prev, { timestamp: now(), type, message }])
  }

  const addSqlLog = (type: LogEntry['type'], message: string) => {
    setSqlLogs((prev) => [...prev, { timestamp: now(), type, message }])
  }

  // ── Schema Sync ──────────────────────────────────────────

  const runSchemaSync = async (forceAcceptDataLoss = false) => {
    const useAcceptDataLoss = forceAcceptDataLoss || acceptDataLoss
    setIsRunningSchema(true)
    setSchemaLogs([])
    addSchemaLog('info', 'Starting Prisma schema synchronization (prisma db push)...')
    if (useAcceptDataLoss) {
      addSchemaLog('warning', 'Running with --accept-data-loss flag enabled')
    }
    addSchemaLog('info', 'This will apply any pending schema changes (indexes, constraints, fields, tables)...')

    try {
      const res = await fetch('/api/admin/migrate/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptDataLoss: useAcceptDataLoss }),
      })
      const data = await res.json()

      if (data.output) {
        // Split output into lines for readability
        const lines = data.output.split('\n').filter((l: string) => l.trim())
        for (const line of lines) {
          addSchemaLog('output', line)
        }
      }

      if (data.durationMs) {
        addSchemaLog('info', `Duration: ${data.durationMs}ms`)
      }

      if (data.status === 'completed') {
        addSchemaLog('success', 'Schema synchronization completed successfully.')
      } else {
        addSchemaLog('error', `Schema sync failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      addSchemaLog('error', `Network error: ${err instanceof Error ? err.message : String(err)}`)
    }

    setIsRunningSchema(false)
  }

  // ── SQL Migrations ───────────────────────────────────────

  const checkSqlStatus = async () => {
    setIsCheckingSql(true)
    setSqlLogs([])
    addSqlLog('info', 'Checking SQL migration status...')

    try {
      const res = await fetch('/api/admin/migrate')
      const data = await res.json()

      if (data.error) {
        addSqlLog('error', data.error)
      } else {
        setSqlStatus(data)
        addSqlLog('info', `Total migrations: ${data.total}`)
        addSqlLog('info', `Applied: ${data.applied.length}`)
        addSqlLog('info', `Pending: ${data.pending.length}`)

        if (data.pending.length > 0) {
          addSqlLog('warning', 'Pending migrations:')
          for (const m of data.pending) {
            addSqlLog('warning', `  - ${m.id}: ${m.description}`)
          }
        } else {
          addSqlLog('success', 'All SQL migrations are up to date.')
        }

        if (data.applied.length > 0) {
          addSqlLog('info', 'Applied migrations:')
          for (const id of data.applied) {
            addSqlLog('info', `  - ${id}`)
          }
        }
      }
    } catch (err) {
      addSqlLog('error', `Network error: ${err instanceof Error ? err.message : String(err)}`)
    }

    setIsCheckingSql(false)
  }

  const runSqlMigrations = async () => {
    setIsRunningSql(true)
    setSqlLogs([])
    setSqlResult(null)
    addSqlLog('info', 'Running pending SQL migrations...')

    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' })
      const data = await res.json()

      if (data.error) {
        addSqlLog('error', data.error)
      } else {
        setSqlResult(data)

        for (const r of data.results) {
          if (r.status === 'success') {
            addSqlLog('success', `${r.id}: Applied successfully`)
          } else if (r.status === 'already_applied') {
            addSqlLog('info', `${r.id}: Already applied (skipped)`)
          } else {
            addSqlLog('error', `${r.id}: FAILED - ${r.error}`)
          }
        }

        addSqlLog('info', '─────────────────────────────────────')
        addSqlLog('info', `Summary: ${data.summary.applied} applied, ${data.summary.skipped} skipped, ${data.summary.failed} failed`)

        if (data.summary.failed === 0) {
          addSqlLog('success', 'All SQL migrations completed successfully.')
        } else {
          addSqlLog('error', `${data.summary.failed} migration(s) failed. See details above.`)
        }
      }
    } catch (err) {
      addSqlLog('error', `Network error: ${err instanceof Error ? err.message : String(err)}`)
    }

    setIsRunningSql(false)
  }

  // ── Copy Helpers ─────────────────────────────────────────

  const formatLogsForCopy = (logs: LogEntry[], title: string) => {
    const lines = [
      `=== ${title} ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      '─'.repeat(60),
      ...logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`),
      '─'.repeat(60),
    ]
    return lines.join('\n')
  }

  const copySchemaLogs = async () => {
    await navigator.clipboard.writeText(formatLogsForCopy(schemaLogs, 'Schema Sync (prisma db push)'))
    setCopiedSchema(true)
    setTimeout(() => setCopiedSchema(false), 2000)
  }

  const copySqlLogs = async () => {
    await navigator.clipboard.writeText(formatLogsForCopy(sqlLogs, 'SQL Migrations'))
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  // ── Render ───────────────────────────────────────────────

  const logTypeStyles: Record<LogEntry['type'], string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    output: 'text-gray-300',
  }

  const logTypeIcon: Record<LogEntry['type'], string> = {
    info: 'INF',
    success: ' OK',
    error: 'ERR',
    warning: 'WRN',
    output: '   ',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-7 w-7 text-indigo-600" />
          Database Migrations
        </h1>
        <p className="text-gray-500 mt-1">
          Run schema synchronization and SQL migrations. Copy the output to share detailed results.
        </p>
      </div>

      {/* Schema Sync Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileCode className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Schema Synchronization</h2>
                <p className="text-sm text-gray-500">
                  Runs <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">prisma db push</code> to
                  sync the Prisma schema with the database (indexes, constraints, fields, tables).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptDataLoss}
                  onChange={(e) => setAcceptDataLoss(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Accept data loss
              </label>
              <button
                onClick={() => runSchemaSync()}
                disabled={isRunningSchema}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isRunningSchema ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Schema Sync
                  </>
                )}
            </button>
            </div>
          </div>
        </div>

        {/* Schema Output */}
        {schemaLogs.length > 0 && (
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={copySchemaLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-xs font-medium"
              >
                {copiedSchema ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Output
                  </>
                )}
              </button>
            </div>
            <pre
              ref={schemaOutputRef}
              className="bg-gray-900 text-gray-100 p-4 text-xs font-mono leading-relaxed max-h-96 overflow-y-auto"
            >
              {schemaLogs.map((log, i) => (
                <div key={i} className={logTypeStyles[log.type]}>
                  <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                  <span className="font-bold">[{logTypeIcon[log.type]}]</span> {log.message}
                </div>
              ))}
              {isRunningSchema && (
                <div className="text-gray-500 animate-pulse mt-1">
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" /> Waiting for response...
                </div>
              )}
            </pre>
            {/* Status bar */}
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between text-xs">
              <StatusBadge logs={schemaLogs} isRunning={isRunningSchema} />
              <span className="text-gray-500">{schemaLogs.length} lines</span>
            </div>
          </div>
        )}
      </div>

      {/* SQL Migrations Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Terminal className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">SQL Migrations</h2>
                <p className="text-sm text-gray-500">
                  Run custom SQL migrations defined in the codebase (ALTER TABLE, CREATE INDEX, etc.).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={checkSqlStatus}
                disabled={isCheckingSql || isRunningSql}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isCheckingSql ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    Check Status
                  </>
                )}
              </button>
              <button
                onClick={runSqlMigrations}
                disabled={isRunningSql || isCheckingSql}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isRunningSql ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Migrations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* SQL Status Summary */}
        {sqlStatus && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-gray-600">Total: {sqlStatus.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-gray-600">Applied: {sqlStatus.applied.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${sqlStatus.pending.length > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} />
              <span className="text-gray-600">Pending: {sqlStatus.pending.length}</span>
            </div>
          </div>
        )}

        {/* SQL Output */}
        {sqlLogs.length > 0 && (
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={copySqlLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-xs font-medium"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Output
                  </>
                )}
              </button>
            </div>
            <pre
              ref={sqlOutputRef}
              className="bg-gray-900 text-gray-100 p-4 text-xs font-mono leading-relaxed max-h-96 overflow-y-auto"
            >
              {sqlLogs.map((log, i) => (
                <div key={i} className={logTypeStyles[log.type]}>
                  <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                  <span className="font-bold">[{logTypeIcon[log.type]}]</span> {log.message}
                </div>
              ))}
              {(isRunningSql || isCheckingSql) && (
                <div className="text-gray-500 animate-pulse mt-1">
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" /> Waiting for response...
                </div>
              )}
            </pre>
            {/* Status bar */}
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between text-xs">
              <StatusBadge logs={sqlLogs} isRunning={isRunningSql || isCheckingSql} />
              <span className="text-gray-500">{sqlLogs.length} lines</span>
            </div>
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <h3 className="font-semibold mb-2">How this works</h3>
        <ul className="space-y-1.5 list-disc list-inside text-blue-700">
          <li>
            <strong>Schema Sync</strong> runs <code className="bg-blue-100 px-1 rounded text-xs font-mono">prisma db push</code> which
            compares <code className="bg-blue-100 px-1 rounded text-xs font-mono">schema.prisma</code> to the actual database and applies
            differences (new indexes, constraints, fields, tables).
          </li>
          <li>
            <strong>SQL Migrations</strong> run custom SQL statements defined in the codebase for changes that Prisma
            doesn&apos;t handle (data migrations, complex ALTER statements).
          </li>
          <li>
            Schema Sync runs <strong>automatically on deployment</strong> (Docker container startup). Use this page to
            re-run manually or troubleshoot issues.
          </li>
          <li>
            Click <strong>Copy Output</strong> to copy all logs for sharing and troubleshooting.
          </li>
        </ul>
      </div>
    </div>
  )
}

function StatusBadge({ logs, isRunning }: { logs: LogEntry[]; isRunning: boolean }) {
  if (isRunning) {
    return (
      <span className="flex items-center gap-1.5 text-blue-400">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Running
      </span>
    )
  }

  const hasError = logs.some((l) => l.type === 'error')
  const hasSuccess = logs.some((l) => l.type === 'success')
  const hasWarning = logs.some((l) => l.type === 'warning')

  if (hasError) {
    return (
      <span className="flex items-center gap-1.5 text-red-400">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    )
  }

  if (hasSuccess) {
    return (
      <span className="flex items-center gap-1.5 text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Success
      </span>
    )
  }

  if (hasWarning) {
    return (
      <span className="flex items-center gap-1.5 text-yellow-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        Warnings
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-gray-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Complete
    </span>
  )
}
