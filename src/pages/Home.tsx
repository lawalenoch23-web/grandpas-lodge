export default function Home() {
  return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <div className="text-center animate-fade-up">
        <p className="text-gold text-xs font-mono tracking-[0.3em] uppercase mb-4">Welcome to</p>
        <h1 className="font-display text-6xl italic text-white mb-2">Grandpa's</h1>
        <h2 className="font-display text-4xl text-gold tracking-widest uppercase mb-8">Lodge</h2>
        <div className="gold-divider max-w-32 mx-auto mb-8" />
        <p className="text-white/40 text-sm mb-6">Guest booking portal coming in Session 2</p>
        <a href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold-light text-lodge font-semibold rounded-xl transition-all text-sm">
          Staff Login →
        </a>
      </div>
    </div>
  )
}
