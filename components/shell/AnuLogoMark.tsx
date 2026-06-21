'use client'

export function AnuLogoMark({
  size = 'md',
  pulse = false,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  pulse?: boolean
}) {
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : size === 'xl' ? 80 : 36
  const strokeW = size === 'sm' ? 4 : size === 'xl' ? 4 : 4.2

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: dim,
        height: dim,
        background: 'radial-gradient(circle at 34% 30%, #8a72d0, #401F60 72%)',
        boxShadow: pulse ? undefined : '0 0 12px rgba(64,31,96,0.3)',
        animation: pulse ? 'orbPulse 2.4s ease-in-out infinite' : undefined,
      }}
    >
      <svg
        width={dim * 0.52}
        height={dim * 0.34}
        viewBox="0 0 24 15"
        fill="none"
        style={{ marginTop: dim * 0.04 }}
      >
        <path
          d="M3.5 2.5 A 8.5 8.5 0 0 0 20.5 2.5"
          stroke="#FCE22A"
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}
