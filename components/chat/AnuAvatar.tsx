'use client'

export function AnuAvatar({ thinking = false, size = 'md' }: { thinking?: boolean; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 40 : 44
  return (
    <div
      className="relative shrink-0"
      style={{ width: dim + 8, height: dim + 8 }}
    >
      {thinking && (
        <>
          <div
            className="absolute inset-0 rounded-full border border-kapruka-header/35"
            style={{ animation: 'ripple 2.4s ease-out infinite' }}
          />
          <div
            className="absolute inset-0 rounded-full border border-kapruka-header/20"
            style={{ animation: 'ripple 2.4s ease-out infinite 0.8s' }}
          />
        </>
      )}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: dim,
          height: dim,
          margin: 4,
          background: 'radial-gradient(circle at 34% 30%, #8a72d0, #401F60 72%)',
          boxShadow: thinking
            ? '0 0 20px rgba(64,31,96,0.55)'
            : '0 0 14px rgba(64,31,96,0.35)',
          animation: thinking ? 'orbPulse 2.4s ease-in-out infinite' : undefined,
        }}
      >
        <svg width={dim * 0.55} height={dim * 0.35} viewBox="0 0 24 15" fill="none" style={{ marginTop: 4 }}>
          <path
            d="M3.5 2.5 A 8.5 8.5 0 0 0 20.5 2.5"
            stroke="#FCE22A"
            strokeWidth="4.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  )
}
