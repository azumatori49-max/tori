/**
 * らくらく店舗カンリ ロゴ
 * 青いサークル＋店舗（オーニング付き）＋チェックマーク入りスマホ
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="lg-ring" x1="10" y1="20" x2="110" y2="110">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d65d8" />
        </linearGradient>
        <linearGradient id="lg-store" x1="30" y1="30" x2="90" y2="100">
          <stop offset="0" stopColor="#2f8af0" />
          <stop offset="1" stopColor="#1d65d8" />
        </linearGradient>
      </defs>
      {/* 外周リング（右下を欠いたスウッシュ） */}
      <path
        d="M60 6a54 54 0 1 0 42.5 87.3l-7.6-6A44.4 44.4 0 1 1 60 15.6Z"
        fill="url(#lg-ring)"
      />
      {/* 店舗: オーニング */}
      <path d="M36 38h48l8 16H28Z" fill="url(#lg-store)" />
      <path
        d="M28 54h13a6.5 6.5 0 0 1-13 0Zm16 0h13a6.5 6.5 0 0 1-13 0Zm16 0h13a6.5 6.5 0 0 1-13 0Zm16 0h13a6.5 6.5 0 0 1-13 0Z"
        fill="url(#lg-store)"
      />
      {/* 店舗: 本体 */}
      <path d="M34 64h52v28H34Z" fill="#fff" fillOpacity="0.001" />
      <rect x="38" y="66" width="16" height="14" rx="1.5" fill="url(#lg-store)" />
      <path d="M60 66h14v26H60Z" fill="url(#lg-store)" />
      <circle cx="63.5" cy="79" r="1.6" fill="#fff" />
      {/* スマホ（傾き付き）＋チェック */}
      <g transform="rotate(12 91 82)">
        <rect
          x="79"
          y="58"
          width="24"
          height="46"
          rx="6"
          fill="#fff"
          stroke="url(#lg-ring)"
          strokeWidth="4"
        />
        <circle cx="91" cy="79" r="9" fill="#1d65d8" />
        <path
          d="M86.5 79l3.2 3.2 5.8-6"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="87" y="62" width="8" height="1.8" rx="0.9" fill="#1d65d8" />
      </g>
    </svg>
  )
}

export function LogoLockup({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div
          className={`font-bold tracking-wide ${light ? 'text-white' : 'text-brand-800'}`}
          style={{ fontSize: size * 0.42 }}
        >
          らくらく店舗カンリ
        </div>
      </div>
    </div>
  )
}
