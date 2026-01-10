export function VaultfireLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Vaultfire Logo"
    >
      {/* Shield outline */}
      <path
        d="M50 10 L85 25 L85 50 C85 70 70 85 50 90 C30 85 15 70 15 50 L15 25 L50 10 Z"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />

      {/* Flame */}
      <path
        d="M50 35 C50 35 42 45 42 52 C42 58 45.5 62 50 62 C54.5 62 58 58 58 52 C58 45 50 35 50 35 Z"
        fill="currentColor"
      />
      <path
        d="M50 40 C50 40 46 47 46 52 C46 55.5 47.5 58 50 58 C52.5 58 54 55.5 54 52 C54 47 50 40 50 40 Z"
        fill="white"
        opacity="0.6"
      />
    </svg>
  );
}

export function VaultfireLogoFull({ className = "h-10" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <VaultfireLogo className="w-10 h-10" />
      <span className="text-2xl font-bold tracking-tight">Vaultfire</span>
    </div>
  );
}
