'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Search, Upload, Loader2, File, FileImage, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

type Document = {
  id: string
  title: string
  type: string
  fileUrl: string
  createdAt: string
}

type AttachmentPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: Document[]
  onSelect: (documentId: string) => Promise<void>
  onUpload?: (file: File) => Promise<void>
  isLoading?: boolean
}

function getFileIcon(type: string) {
  const lowerType = type.toLowerCase()
  if (lowerType.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].some(ext => lowerType.includes(ext))) {
    return FileImage
  }
  if (lowerType.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].some(ext => lowerType.includes(ext))) {
    return FileSpreadsheet
  }
  return File
}

export function AttachmentPicker({
  open,
  onOpenChange,
  documents,
  onSelect,
  onUpload,
  isLoading = false,
}: AttachmentPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = async () => {
    if (!selectedDocId) return

    setIsSubmitting(true)
    try {
      await onSelect(selectedDocId)
      setSelectedDocId(null)
      setSearchQuery('')
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return

    setIsSubmitting(true)
    try {
      await onUpload(file)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Attach a Document
          </DialogTitle>
          <DialogDescription>
            Select an existing document or upload a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="pl-9"
            />
          </div>

          {/* Document list */}
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No documents found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredDocs.map((doc) => {
                  const FileIcon = getFileIcon(doc.type)
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={cn(
                        'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                        selectedDocId === doc.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        selectedDocId === doc.id ? 'bg-blue-100' : 'bg-gray-100'
                      )}>
                        <FileIcon className={cn(
                          'h-4 w-4',
                          selectedDocId === doc.id ? 'text-blue-600' : 'text-gray-600'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                      </div>
                      {selectedDocId === doc.id && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upload option */}
          {onUpload && (
            <div className="border-t pt-4">
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Upload a new document</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedDocId(null)
              setSearchQuery('')
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedDocId || isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
