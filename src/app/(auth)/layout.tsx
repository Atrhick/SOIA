export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/20 via-transparent to-primary-400/20 animate-gradient" />

      {/* Floating shapes */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary-400/30 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-glow animation-delay-200" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary-300/20 rounded-full blur-3xl animate-pulse-glow animation-delay-400" />

      {/* Decorative floating elements */}
      <div className="absolute top-1/4 right-1/4 w-20 h-20 border border-white/10 rounded-2xl rotate-12 animate-float" />
      <div className="absolute bottom-1/4 left-1/3 w-16 h-16 border border-white/10 rounded-full animate-float-delayed" />
      <div className="absolute top-1/3 left-1/6 w-12 h-12 bg-white/5 rounded-lg rotate-45 animate-float animation-delay-300" />
      <div className="absolute bottom-1/3 right-1/6 w-24 h-24 border border-white/5 rounded-3xl -rotate-12 animate-float-delayed animation-delay-200" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md p-6">
        {children}
      </div>
    </div>
  )
}
