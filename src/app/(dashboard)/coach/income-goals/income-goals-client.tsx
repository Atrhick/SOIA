'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  createWeeklyGoal,
  updateWeeklyGoal,
  deleteWeeklyGoal,
  createIncomeEntry,
  deleteIncomeEntry,
} from '@/lib/actions/income-goals'
import {
  Target,
  DollarSign,
  Plus,
  Trash2,
  Check,
  Calendar,
  TrendingUp,
  PiggyBank,
} from 'lucide-react'

interface WeeklyGoal {
  id: string
  title: string
  targetValue: number
  actualValue: number | null
  status: string
  notes: string | null
  weekStart: string
  weekEnd: string
}

interface IncomeEntry {
  id: string
  date: string
  activityType: string
  description: string | null
  amount: number
}

interface Stats {
  monthlyIncome: number
  weeklyIncome: number
  totalEntries: number
  goalsCompleted: number
  currentGoal: WeeklyGoal | null | undefined
}

const activityTypeLabels: Record<string, string> = {
  OWN_SERVICES: 'Own Services',
  TEACHING_CLASSES: 'Teaching Classes',
  FUNDRAISING: 'Fundraising',
  OTHER: 'Other',
}

const goalStatusVariants: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  COMPLETED: 'success',
  PARTIALLY_COMPLETED: 'warning',
  NOT_COMPLETED: 'destructive',
}

export function IncomeGoalsClient({
  goals,
  incomeEntries,
  stats,
}: {
  goals: WeeklyGoal[]
  incomeEntries: IncomeEntry[]
  stats: Stats
}) {
  const [activeTab, setActiveTab] = useState<'goals' | 'income'>('goals')
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Goal form submission
  const handleGoalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createWeeklyGoal(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowGoalForm(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  // Income form submission
  const handleIncomeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createIncomeEntry(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowIncomeForm(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  // Update goal status
  const handleUpdateGoalStatus = async (
    goalId: string,
    status: string,
    actualValue?: number
  ) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.append('status', status)
    if (actualValue !== undefined) {
      formData.append('actualValue', actualValue.toString())
    }
    await updateWeeklyGoal(goalId, formData)
    setIsLoading(false)
  }

  // Delete goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return
    setIsLoading(true)
    await deleteWeeklyGoal(goalId)
    setIsLoading(false)
  }

  // Delete income entry
  const handleDeleteIncome = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return
    setIsLoading(true)
    await deleteIncomeEntry(entryId)
    setIsLoading(false)
  }

  // Get start of current week (Sunday)
  const getWeekStart = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day
    const weekStart = new Date(now.setDate(diff))
    return weekStart.toISOString().split('T')[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Income & Goals</h1>
        <p className="text-gray-600">Track your income and set weekly goals</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.monthlyIncome.toFixed(2)}</p>
                <p className="text-sm text-gray-500">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.weeklyIncome.toFixed(2)}</p>
                <p className="text-sm text-gray-500">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <PiggyBank className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEntries}</p>
                <p className="text-sm text-gray-500">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.goalsCompleted}</p>
                <p className="text-sm text-gray-500">Goals Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Week Goal Progress */}
      {stats.currentGoal && (
        <Card className="border-primary-200 bg-primary-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-primary-900">
                Current Week Goal: {stats.currentGoal.title}
              </h3>
              <Badge variant={goalStatusVariants[stats.currentGoal.status]}>
                {stats.currentGoal.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <Progress
                value={
                  stats.currentGoal.actualValue
                    ? (stats.currentGoal.actualValue / stats.currentGoal.targetValue) * 100
                    : 0
                }
                className="flex-1"
              />
              <span className="text-sm font-medium">
                {stats.currentGoal.actualValue || 0} / {stats.currentGoal.targetValue}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'goals'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="inline-block h-4 w-4 mr-2" />
          Weekly Goals
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'income'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="inline-block h-4 w-4 mr-2" />
          Income Log
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowGoalForm(!showGoalForm)}>
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </div>

          {/* Goal Form */}
          {showGoalForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create Weekly Goal</CardTitle>
                <CardDescription>Set a goal for the week</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGoalSubmit} className="space-y-4">
                  <Input
                    name="title"
                    label="Goal Title"
                    placeholder="e.g., Make 10 sales calls"
                    required
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      name="targetValue"
                      label="Target Value"
                      type="number"
                      min="1"
                      placeholder="10"
                      required
                    />
                    <Input
                      name="weekStart"
                      label="Week Start (Sunday)"
                      type="date"
                      defaultValue={getWeekStart()}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      name="notes"
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowGoalForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                      Create Goal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Goals List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Goals</CardTitle>
            </CardHeader>
            <CardContent>
              {goals.length > 0 ? (
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{goal.title}</h4>
                          <p className="text-sm text-gray-500">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            {new Date(goal.weekStart).toLocaleDateString()} -{' '}
                            {new Date(goal.weekEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={goalStatusVariants[goal.status]}>
                          {goal.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <Progress
                          value={
                            goal.actualValue
                              ? (goal.actualValue / goal.targetValue) * 100
                              : 0
                          }
                          className="flex-1"
                        />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {goal.actualValue || 0} / {goal.targetValue}
                        </span>
                      </div>

                      {goal.notes && (
                        <p className="text-sm text-gray-600">{goal.notes}</p>
                      )}

                      <div className="flex gap-2 pt-2">
                        {goal.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const value = prompt(
                                  'Enter actual value achieved:',
                                  goal.actualValue?.toString() || '0'
                                )
                                if (value) {
                                  const numVal = parseInt(value)
                                  const status =
                                    numVal >= goal.targetValue
                                      ? 'COMPLETED'
                                      : numVal > 0
                                        ? 'PARTIALLY_COMPLETED'
                                        : 'PENDING'
                                  handleUpdateGoalStatus(goal.id, status, numVal)
                                }
                              }}
                            >
                              Update Progress
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() =>
                                handleUpdateGoalStatus(
                                  goal.id,
                                  'COMPLETED',
                                  goal.targetValue
                                )
                              }
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No goals yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowGoalForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Goal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowIncomeForm(!showIncomeForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Log Income
            </Button>
          </div>

          {/* Income Form */}
          {showIncomeForm && (
            <Card>
              <CardHeader>
                <CardTitle>Log Income</CardTitle>
                <CardDescription>Record an income entry</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIncomeSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      name="date"
                      label="Date"
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <Input
                      name="amount"
                      label="Amount ($)"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activity Type
                    </label>
                    <select
                      name="activityType"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="OWN_SERVICES">Own Services</option>
                      <option value="TEACHING_CLASSES">Teaching Classes</option>
                      <option value="FUNDRAISING">Fundraising</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      name="description"
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="What was this income for?"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowIncomeForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                      Log Income
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Income List */}
          <Card>
            <CardHeader>
              <CardTitle>Income History</CardTitle>
            </CardHeader>
            <CardContent>
              {incomeEntries.length > 0 ? (
                <div className="divide-y">
                  {incomeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="py-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">
                            ${entry.amount.toFixed(2)}
                          </span>
                          <Badge variant="secondary">
                            {activityTypeLabels[entry.activityType]}
                          </Badge>
                        </div>
                        {entry.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {entry.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleDeleteIncome(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">No income logged yet</p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowIncomeForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log First Entry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
