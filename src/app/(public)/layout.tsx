export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center">
            {/* Text logo: there is no /public/logo.png in the repo, so the old image never loaded. */}
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-primary-700 text-white font-bold text-sm flex items-center justify-center" aria-hidden="true">NT</span>
              <span className="font-semibold text-gray-900">NowTransformed</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} NowTransformed. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
