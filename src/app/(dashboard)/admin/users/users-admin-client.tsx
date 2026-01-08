'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Shield,
  UserCog,
  Trash2,
  Key,
  Loader2,
  Check,
  X,
  Search,
  Settings,
} from 'lucide-react'
import {
  createUser,
  updateUserRole,
  deleteUser,
  resetUserPassword,
  getUserFeaturePermissions,
  setUserFeaturePermissions,
} from '@/lib/actions/users'
import { PasswordInput } from '@/components/ui/password-input'

type User = {
  id: string
  email: string
  role: string
  createdAt: string
  firstName: string | null
  lastName: string | null
  status: string | null
  coachId: string | null
  ambassadorId: string | null
}

type FeatureConfig = {
  id: string
  feature: string
  isEnabled: boolean
  enabledForCoaches: boolean
  enabledForAmbassadors: boolean
}

type UserPermission = {
  feature: string
  granted: boolean
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  COACH: 'bg-blue-100 text-blue-800',
  AMBASSADOR: 'bg-green-100 text-green-800',
  PARENT: 'bg-purple-100 text-purple-800',
}

const FEATURE_INFO: Record<string, { label: string; description: string }> = {
  CRM: { label: 'CRM', description: 'Manage contacts, deals, and sales pipeline' },
  PROJECT_MANAGEMENT: { label: 'Project Management', description: 'Create and track projects and tasks' },
  COLLABORATION: { label: 'Collaboration', description: 'Team discussions and document sharing' },
  TIME_CLOCK: { label: 'Time Clock', description: 'Clock in/out and time tracking' },
  SCHEDULING: { label: 'Scheduling', description: 'Calendar events and appointments' },
  KNOWLEDGE_BASE: { label: 'Knowledge Base', description: 'Articles and documentation' },
}

export function UsersAdminClient({
  users: initialUsers,
  features,
}: {
  users: User[]
  features: FeatureConfig[]
}) {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [isUserDetailDialogOpen, setIsUserDetailDialogOpen] = useState(false)

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create form state
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('COACH')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, boolean | null>>({})

  // Reset password state
  const [resetPassword, setResetPassword] = useState('')

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  const resetCreateForm = () => {
    setNewEmail('')
    setNewPassword('')
    setNewRole('COACH')
    setNewFirstName('')
    setNewLastName('')
    setNewUserPermissions({})
    setError(null)
  }

  const handleOpenUserDetail = async (user: User) => {
    setSelectedUser(user)
    setIsLoadingPermissions(true)
    setIsUserDetailDialogOpen(true)
    setError(null)

    try {
      const result = await getUserFeaturePermissions(user.id)
      if (result.permissions) {
        setUserPermissions(result.permissions)
      }
    } catch (err) {
      console.error('Error loading permissions:', err)
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  const getRoleDefaultAccess = (role: string, feature: string): boolean => {
    if (role === 'ADMIN') return true
    const config = features.find(f => f.feature === feature)
    if (!config || !config.isEnabled) return false
    if (role === 'COACH') return config.enabledForCoaches
    if (role === 'AMBASSADOR') return config.enabledForAmbassadors
    return false
  }

  const getEffectiveAccess = (role: string, feature: string, permissions: UserPermission[]): { hasAccess: boolean; isOverride: boolean } => {
    const override = permissions.find(p => p.feature === feature)
    if (override) {
      return { hasAccess: override.granted, isOverride: true }
    }
    return { hasAccess: getRoleDefaultAccess(role, feature), isOverride: false }
  }

  const handlePermissionChange = (feature: string, value: 'default' | 'granted' | 'denied') => {
    if (value === 'default') {
      setUserPermissions(userPermissions.filter(p => p.feature !== feature))
    } else {
      const existing = userPermissions.find(p => p.feature === feature)
      if (existing) {
        setUserPermissions(userPermissions.map(p =>
          p.feature === feature ? { ...p, granted: value === 'granted' } : p
        ))
      } else {
        setUserPermissions([...userPermissions, { feature, granted: value === 'granted' }])
      }
    }
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      const result = await setUserFeaturePermissions(selectedUser.id, userPermissions)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Permissions updated successfully')
        setIsUserDetailDialogOpen(false)
      }
    } catch (err) {
      setError('Failed to save permissions')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) {
      setError('Email and password are required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.set('email', newEmail)
    formData.set('password', newPassword)
    formData.set('role', newRole)
    formData.set('firstName', newFirstName)
    formData.set('lastName', newLastName)

    try {
      const result = await createUser(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.user) {
        // Set permissions for the new user
        const permissionsToSet = Object.entries(newUserPermissions)
          .filter(([_, value]) => value !== null)
          .map(([feature, granted]) => ({ feature, granted: granted as boolean }))

        if (permissionsToSet.length > 0) {
          await setUserFeaturePermissions(result.user.id, permissionsToSet)
        }

        setSuccess('User created successfully')
        setIsCreateDialogOpen(false)
        resetCreateForm()
        window.location.reload()
      }
    } catch (err) {
      setError('Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setIsSubmitting(true)
    try {
      const result = await updateUserRole(userId, newRole)
      if (result.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
        setSuccess('Role updated successfully')
      }
    } catch (err) {
      setError('Failed to update role')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      const result = await deleteUser(selectedUser.id)
      if (result.error) {
        setError(result.error)
      } else {
        setUsers(users.filter(u => u.id !== selectedUser.id))
        setSuccess('User deleted successfully')
        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
      }
    } catch (err) {
      setError('Failed to delete user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!selectedUser || !resetPassword) return

    setIsSubmitting(true)
    try {
      const result = await resetUserPassword(selectedUser.id, resetPassword)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Password reset successfully')
        setIsResetPasswordDialogOpen(false)
        setSelectedUser(null)
        setResetPassword('')
      }
    } catch (err) {
      setError('Failed to reset password')
    } finally {
      setIsSubmitting(false)
    }
  }

  const userCounts = {
    total: users.length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    coaches: users.filter(u => u.role === 'COACH').length,
    ambassadors: users.filter(u => u.role === 'AMBASSADOR').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">
            Create and manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCounts.total}</p>
                <p className="text-sm text-gray-500">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCounts.admins}</p>
                <p className="text-sm text-gray-500">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserCog className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCounts.coaches}</p>
                <p className="text-sm text-gray-500">Coaches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCounts.ambassadors}</p>
                <p className="text-sm text-gray-500">Ambassadors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Click on a user to manage their feature permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="COACH">Coach</SelectItem>
                <SelectItem value="AMBASSADOR">Ambassador</SelectItem>
                <SelectItem value="PARENT">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Created</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenUserDetail(user)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.email}</p>
                        {(user.firstName || user.lastName) && (
                          <p className="text-sm text-gray-500">
                            {user.firstName} {user.lastName}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleUpdateRole(user.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <Badge className={ROLE_COLORS[user.role] || 'bg-gray-100'}>
                            {user.role}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="COACH">Coach</SelectItem>
                          <SelectItem value="AMBASSADOR">Ambassador</SelectItem>
                          <SelectItem value="PARENT">Parent</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {user.status && (
                        <Badge variant="outline" className="text-xs">
                          {user.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUserDetail(user)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setIsResetPasswordDialogOpen(true)
                          }}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedUser(user)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Detail / Permissions Dialog */}
      <Dialog open={isUserDetailDialogOpen} onOpenChange={setIsUserDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Permissions</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} ({selectedUser?.role})
            </DialogDescription>
          </DialogHeader>

          {isLoadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <h3 className="font-medium">Feature Access</h3>
                <p className="text-sm text-gray-500">
                  Override default role permissions for this user. &quot;Default&quot; uses the role-based setting.
                </p>
              </div>

              <div className="border rounded-lg divide-y">
                {features.filter(f => f.isEnabled).map((feature) => {
                  const info = FEATURE_INFO[feature.feature] || { label: feature.feature, description: '' }
                  const { hasAccess, isOverride } = selectedUser
                    ? getEffectiveAccess(selectedUser.role, feature.feature, userPermissions)
                    : { hasAccess: false, isOverride: false }
                  const roleDefault = selectedUser ? getRoleDefaultAccess(selectedUser.role, feature.feature) : false
                  const currentOverride = userPermissions.find(p => p.feature === feature.feature)

                  return (
                    <div key={feature.id} className="p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{info.label}</span>
                          {isOverride && (
                            <Badge variant={hasAccess ? 'success' : 'destructive'} className="text-xs">
                              {hasAccess ? 'Granted' : 'Denied'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{info.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Role default: {roleDefault ? 'Allowed' : 'Not allowed'}
                        </p>
                      </div>
                      <Select
                        value={currentOverride ? (currentOverride.granted ? 'granted' : 'denied') : 'default'}
                        onValueChange={(value) => handlePermissionChange(feature.feature, value as 'default' | 'granted' | 'denied')}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Default ({roleDefault ? 'Allow' : 'Deny'})
                          </SelectItem>
                          <SelectItem value="granted">Grant Access</SelectItem>
                          <SelectItem value="denied">Deny Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDetailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={isSubmitting || isLoadingPermissions}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with custom permissions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <PasswordInput
                id="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Enter password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin - Full system access</SelectItem>
                  <SelectItem value="COACH">Coach - Coach dashboard access</SelectItem>
                  <SelectItem value="AMBASSADOR">Ambassador - Ambassador dashboard access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feature Permissions */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <h3 className="font-medium">Feature Permissions</h3>
                <p className="text-sm text-gray-500">
                  Customize which features this user can access
                </p>
              </div>

              <div className="border rounded-lg divide-y">
                {features.filter(f => f.isEnabled).map((feature) => {
                  const info = FEATURE_INFO[feature.feature] || { label: feature.feature, description: '' }
                  const roleDefault = getRoleDefaultAccess(newRole, feature.feature)
                  const currentValue = newUserPermissions[feature.feature]

                  return (
                    <div key={feature.id} className="p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-sm">{info.label}</span>
                        <p className="text-xs text-gray-400">
                          Role default: {roleDefault ? 'Allowed' : 'Not allowed'}
                        </p>
                      </div>
                      <Select
                        value={currentValue === null || currentValue === undefined ? 'default' : (currentValue ? 'granted' : 'denied')}
                        onValueChange={(value) => {
                          if (value === 'default') {
                            const updated = { ...newUserPermissions }
                            delete updated[feature.feature]
                            setNewUserPermissions(updated)
                          } else {
                            setNewUserPermissions({
                              ...newUserPermissions,
                              [feature.feature]: value === 'granted'
                            })
                          }
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Default ({roleDefault ? 'Allow' : 'Deny'})
                          </SelectItem>
                          <SelectItem value="granted">Grant Access</SelectItem>
                          <SelectItem value="denied">Deny Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                resetCreateForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded text-sm mb-4">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resetPassword">New Password</Label>
              <PasswordInput
                id="resetPassword"
                value={resetPassword}
                onChange={setResetPassword}
                placeholder="Enter new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetPasswordDialogOpen(false)
                setResetPassword('')
                setError(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isSubmitting || !resetPassword}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
