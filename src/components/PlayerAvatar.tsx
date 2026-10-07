import React, { useId } from 'react'

export interface AvatarConfig {
  id: string
  name: string
  backgroundColor: string // inicio del degradado de fondo
  accentColor: string // fin del degradado de fondo
  mascot: MascotKind
}

type MascotKind =
  | 'gem' | 'wave' | 'flame' | 'sprout' | 'sun' | 'candy' | 'fish' | 'moon'
  | 'star' | 'ice' | 'tulip' | 'lime' | 'wizard' | 'coin' | 'pine' | 'cloud'
  | 'lollipop' | 'robot' | 'heart' | 'bulb' | 'leaf' | 'comet' | 'royal' | 'blossom'
  | 'pineapple' | 'coolSun' | 'octopus' | 'sunset' | 'drop' | 'battery' | 'planet' | 'mug'

type Mood = 'smile' | 'open' | 'wink' | 'cool'

interface PlayerAvatarProps {
  avatar: string // ID del avatar
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Los IDs se guardan en players.avatar: no renombrarlos
const AVATAR_CONFIGS: Record<string, AvatarConfig> = {
  'purple-geo': { id: 'purple-geo', name: 'Gema Púrpura', backgroundColor: '#7c3aed', accentColor: '#d946ef', mascot: 'gem' },
  'blue-wave': { id: 'blue-wave', name: 'Ola Azul', backgroundColor: '#1d4ed8', accentColor: '#22d3ee', mascot: 'wave' },
  'red-fire': { id: 'red-fire', name: 'Fuego Rojo', backgroundColor: '#dc2626', accentColor: '#f97316', mascot: 'flame' },
  'green-nature': { id: 'green-nature', name: 'Brote Verde', backgroundColor: '#15803d', accentColor: '#84cc16', mascot: 'sprout' },
  'orange-sun': { id: 'orange-sun', name: 'Sol Naranja', backgroundColor: '#ea580c', accentColor: '#f59e0b', mascot: 'sun' },
  'pink-candy': { id: 'pink-candy', name: 'Dulce Rosa', backgroundColor: '#db2777', accentColor: '#fb7185', mascot: 'candy' },
  'teal-ocean': { id: 'teal-ocean', name: 'Pez del Océano', backgroundColor: '#0f766e', accentColor: '#0ea5e9', mascot: 'fish' },
  'indigo-night': { id: 'indigo-night', name: 'Luna de Noche', backgroundColor: '#312e81', accentColor: '#6366f1', mascot: 'moon' },
  'yellow-star': { id: 'yellow-star', name: 'Estrella Amarilla', backgroundColor: '#d97706', accentColor: '#facc15', mascot: 'star' },
  'cyan-ice': { id: 'cyan-ice', name: 'Cubito de Hielo', backgroundColor: '#0e7490', accentColor: '#22d3ee', mascot: 'ice' },
  'rose-garden': { id: 'rose-garden', name: 'Tulipán del Jardín', backgroundColor: '#be123c', accentColor: '#fb7185', mascot: 'tulip' },
  'lime-fresh': { id: 'lime-fresh', name: 'Lima Fresca', backgroundColor: '#4d7c0f', accentColor: '#84cc16', mascot: 'lime' },
  'violet-magic': { id: 'violet-magic', name: 'Magia Violeta', backgroundColor: '#5b21b6', accentColor: '#a855f7', mascot: 'wizard' },
  'amber-gold': { id: 'amber-gold', name: 'Moneda de Oro', backgroundColor: '#b45309', accentColor: '#f59e0b', mascot: 'coin' },
  'emerald-forest': { id: 'emerald-forest', name: 'Bosque Esmeralda', backgroundColor: '#065f46', accentColor: '#10b981', mascot: 'pine' },
  'sky-dream': { id: 'sky-dream', name: 'Nube de Sueños', backgroundColor: '#0369a1', accentColor: '#38bdf8', mascot: 'cloud' },
  'fuchsia-pop': { id: 'fuchsia-pop', name: 'Paleta Fucsia', backgroundColor: '#a21caf', accentColor: '#f472b6', mascot: 'lollipop' },
  'slate-modern': { id: 'slate-modern', name: 'Robot Moderno', backgroundColor: '#334155', accentColor: '#64748b', mascot: 'robot' },
  'red-passion': { id: 'red-passion', name: 'Pasión Roja', backgroundColor: '#9f1239', accentColor: '#ef4444', mascot: 'heart' },
  'blue-electric': { id: 'blue-electric', name: 'Idea Eléctrica', backgroundColor: '#1e3a8a', accentColor: '#3b82f6', mascot: 'bulb' },
  'green-mint': { id: 'green-mint', name: 'Hoja de Menta', backgroundColor: '#047857', accentColor: '#4ade80', mascot: 'leaf' },
  'orange-blaze': { id: 'orange-blaze', name: 'Cometa Naranja', backgroundColor: '#9a3412', accentColor: '#fb923c', mascot: 'comet' },
  'purple-royal': { id: 'purple-royal', name: 'Púrpura Real', backgroundColor: '#581c87', accentColor: '#9333ea', mascot: 'royal' },
  'pink-blossom': { id: 'pink-blossom', name: 'Flor Rosa', backgroundColor: '#be185d', accentColor: '#f472b6', mascot: 'blossom' },
  'teal-tropical': { id: 'teal-tropical', name: 'Piña Tropical', backgroundColor: '#0f766e', accentColor: '#2dd4bf', mascot: 'pineapple' },
  'yellow-sunshine': { id: 'yellow-sunshine', name: 'Sol Brillante', backgroundColor: '#ea580c', accentColor: '#facc15', mascot: 'coolSun' },
  'indigo-deep': { id: 'indigo-deep', name: 'Pulpo del Fondo', backgroundColor: '#1e1b4b', accentColor: '#4f46e5', mascot: 'octopus' },
  'rose-sunset': { id: 'rose-sunset', name: 'Atardecer Rosa', backgroundColor: '#e11d48', accentColor: '#fb923c', mascot: 'sunset' },
  'cyan-aqua': { id: 'cyan-aqua', name: 'Gota de Agua', backgroundColor: '#0e7490', accentColor: '#2dd4bf', mascot: 'drop' },
  'lime-energy': { id: 'lime-energy', name: 'Energía Lima', backgroundColor: '#3f6212', accentColor: '#a3e635', mascot: 'battery' },
  'violet-dream': { id: 'violet-dream', name: 'Planeta de Sueños', backgroundColor: '#4c1d95', accentColor: '#8b5cf6', mascot: 'planet' },
  'amber-warm': { id: 'amber-warm', name: 'Taza Calentita', backgroundColor: '#92400e', accentColor: '#f59e0b', mascot: 'mug' }
}

const INK = '#221b4b'

// Carita compartida por todos los personajes
const Face: React.FC<{ x?: number; y?: number; s?: number; mood?: Mood }> = ({ x = 50, y = 55, s = 1, mood = 'smile' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="-14" cy="4.5" rx="4.5" ry="3" fill="#ff5c93" opacity="0.5" />
    <ellipse cx="14" cy="4.5" rx="4.5" ry="3" fill="#ff5c93" opacity="0.5" />
    {mood === 'cool' ? (
      <>
        <rect x="-17" y="-7" width="15" height="10" rx="4.5" fill={INK} />
        <rect x="2" y="-7" width="15" height="10" rx="4.5" fill={INK} />
        <rect x="-3" y="-5.5" width="6" height="2.6" fill={INK} />
        <path d="M-13.5 -4 H-9.5 M5.5 -4 H9.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
      </>
    ) : (
      <>
        <circle cx="-8" cy="-1" r="3.9" fill={INK} />
        <circle cx="-6.7" cy="-2.4" r="1.4" fill="#fff" />
        {mood === 'wink' ? (
          <path d="M4.2 -0.5 Q8 -4.8 11.8 -0.5" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="8" cy="-1" r="3.9" fill={INK} />
            <circle cx="9.3" cy="-2.4" r="1.4" fill="#fff" />
          </>
        )}
      </>
    )}
    {mood === 'open' ? (
      <path d="M-4.8 4.5 Q0 12.5 4.8 4.5 Z" fill={INK} />
    ) : (
      <path d="M-4.5 5 Q0 9.8 4.5 5" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    )}
  </g>
)

// Destello de cuatro puntas
const Sparkle: React.FC<{ x: number; y: number; r: number; fill?: string; opacity?: number }> = ({ x, y, r, fill = '#fff', opacity = 0.9 }) => (
  <path
    d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
    fill={fill}
    opacity={opacity}
  />
)

// Personajes dibujados en un lienzo de 100x100, centrados cerca de (50, 54)
const renderMascot = (kind: MascotKind, uid: string) => {
  switch (kind) {
    case 'gem':
      return (
        <>
          <polygon points="27,44 39,27 61,27 73,44 50,81" fill="#f5f3ff" stroke="#f5f3ff" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="27,44 39,27 61,27 73,44" fill="#ddd6fe" />
          <path d="M39 27 L43 44 M61 27 L57 44 M27 44 H73" stroke="#c4b5fd" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M43 44 L50 78 L57 44" stroke="#ede9fe" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          <Sparkle x={79} y={27} r={5} />
          <Face y={57} s={0.7} />
        </>
      )

    case 'wave':
      return (
        <>
          <path d="M20 74 C20 46 36 28 57 29 C71 30 79 40 76 51 C72 44 64 43 60 48 C69 52 80 61 80 74 Z" fill="#eff6ff" />
          <path d="M57 29 C71 30 79 40 76 51 C72 44 64 43 60 48 C60 40 62 34 57 29 Z" fill="#bfdbfe" />
          <circle cx="80" cy="33" r="3" fill="#fff" opacity="0.8" />
          <circle cx="86" cy="43" r="2" fill="#fff" opacity="0.7" />
          <Face x={45} y={59} s={0.8} mood="open" />
        </>
      )

    case 'flame':
      return (
        <>
          <path d="M50 18 C56 32 73 42 73 59 C73 73 63 82 50 82 C37 82 27 73 27 59 C27 50 32 44 37 37 C39 45 44 46 46 41 C47 33 48 26 50 18 Z" fill="#fde047" />
          <path d="M50 42 C55 51 63 56 63 65 C63 74 57 79 50 79 C43 79 37 74 37 65 C37 58 45 52 50 42 Z" fill="#fffbeb" />
          <Face y={64} s={0.7} />
        </>
      )

    case 'sprout':
      return (
        <>
          <path d="M50 42 V29" stroke="#bbf7d0" strokeWidth="4.5" strokeLinecap="round" />
          <ellipse cx="38" cy="26" rx="13" ry="7" fill="#bbf7d0" transform="rotate(-28 38 26)" />
          <ellipse cx="62" cy="26" rx="13" ry="7" fill="#f0fdf4" transform="rotate(28 62 26)" />
          <circle cx="50" cy="61" r="22" fill="#f0fdf4" />
          <Face y={61} s={0.88} />
        </>
      )

    case 'sun':
      return (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect key={angle} x="47.2" y="17" width="5.6" height="12" rx="2.8" fill="#fff3bf" transform={`rotate(${angle} 50 53)`} />
          ))}
          <circle cx="50" cy="53" r="20.5" fill="#fde047" />
          <Face y={54} s={0.88} mood="open" />
        </>
      )

    case 'candy':
      return (
        <>
          <polygon points="34,53 15,39 19,53 15,67" fill="#fbcfe8" stroke="#fbcfe8" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="66,53 85,39 81,53 85,67" fill="#fbcfe8" stroke="#fbcfe8" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="50" cy="53" r="20" fill="#fff" />
          <path d="M35 43 Q48 36 62 39" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M37 66 Q50 72 64 64" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <Face y={54} s={0.78} mood="wink" />
        </>
      )

    case 'fish':
      return (
        <>
          <polygon points="64,55 85,39 80,55 85,71" fill="#99f6e4" stroke="#99f6e4" strokeWidth="3" strokeLinejoin="round" />
          <path d="M36 40 Q47 25 60 41 Z" fill="#99f6e4" />
          <ellipse cx="45" cy="56" rx="26" ry="19.5" fill="#f0fdfa" />
          <circle cx="78" cy="27" r="3" fill="#fff" opacity="0.75" />
          <circle cx="85" cy="19" r="2" fill="#fff" opacity="0.6" />
          <Face x={41} y={56} s={0.8} mood="open" />
        </>
      )

    case 'moon':
      return (
        <>
          <Sparkle x={21} y={31} r={5.5} fill="#fde68a" />
          <Sparkle x={80} y={25} r={4.5} fill="#fde68a" />
          <Sparkle x={82} y={73} r={3.5} fill="#fde68a" />
          <circle cx="50" cy="54" r="23.5" fill="#fef3c7" />
          <circle cx="37" cy="42" r="4" fill="#fde68a" />
          <circle cx="64" cy="68" r="5" fill="#fde68a" />
          <circle cx="66" cy="43" r="2.6" fill="#fde68a" />
          <Face y={55} s={0.84} mood="wink" />
        </>
      )

    case 'star':
      return (
        <>
          <polygon
            points="50,25 57.9,43.1 77.6,45 62.8,58.2 67.1,77.5 50,67.5 32.9,77.5 37.2,58.2 22.4,45 42.1,43.1"
            fill="#fffbeb"
            stroke="#fffbeb"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <Face y={56} s={0.72} />
        </>
      )

    case 'ice':
      return (
        <>
          <Sparkle x={22} y={28} r={5} />
          <Sparkle x={81} y={32} r={4} />
          <g transform="rotate(-7 50 55)">
            <rect x="28" y="33" width="44" height="44" rx="12" fill="#ecfeff" />
            <rect x="34" y="39" width="13" height="4.5" rx="2.25" fill="#a5f3fc" />
            <rect x="50" y="39" width="5" height="4.5" rx="2.25" fill="#a5f3fc" />
          </g>
          <Face y={59} s={0.85} />
        </>
      )

    case 'tulip':
      return (
        <>
          <path d="M50 70 V86" stroke="#bbf7d0" strokeWidth="4.5" strokeLinecap="round" />
          <ellipse cx="61" cy="80" rx="10" ry="4.5" fill="#bbf7d0" transform="rotate(-30 61 80)" />
          <path d="M29 34 L41 46 L50 30 L59 46 L71 34 C73 58 65 72 50 72 C35 72 27 58 29 34 Z" fill="#fff1f2" stroke="#fff1f2" strokeWidth="3" strokeLinejoin="round" />
          <Face y={58} s={0.78} />
        </>
      )

    case 'lime':
      return (
        <>
          <circle cx="50" cy="54" r="26" fill="#f7fee7" />
          <circle cx="50" cy="54" r="21" fill="#bef264" />
          {[0, 60, 120].map((angle) => (
            <path key={angle} d="M50 33 V75" stroke="#f7fee7" strokeWidth="2.6" opacity="0.8" transform={`rotate(${angle} 50 54)`} />
          ))}
          <Face y={55} s={0.78} />
        </>
      )

    case 'wizard':
      return (
        <>
          <Sparkle x={24} y={36} r={5} fill="#fde047" />
          <Sparkle x={79} y={46} r={4} fill="#fde047" />
          <path d="M53 17 C57 33 65 50 69 66 H31 C35 52 45 34 53 17 Z" fill="#f5f3ff" stroke="#f5f3ff" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="50" cy="68" rx="31" ry="8.5" fill="#ddd6fe" />
          <path d="M33 62 Q50 69 67 62" stroke="#fde047" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <Sparkle x={52} y={33} r={4.5} fill="#fde047" />
          <Face y={51} s={0.6} />
        </>
      )

    case 'coin':
      return (
        <>
          <Sparkle x={22} y={30} r={5} />
          <Sparkle x={80} y={72} r={4} />
          <circle cx="50" cy="54" r="25.5" fill="#fde68a" stroke="#fffbeb" strokeWidth="3" />
          <circle cx="50" cy="54" r="19.5" fill="#fef3c7" />
          <Face y={55} s={0.8} mood="wink" />
        </>
      )

    case 'pine':
      return (
        <>
          <rect x="45" y="74" width="10" height="11" rx="3" fill="#fde68a" />
          <g fill="#ecfdf5" stroke="#ecfdf5" strokeWidth="5" strokeLinejoin="round">
            <polygon points="50,19 65,40 35,40" />
            <polygon points="50,31 71,58 29,58" />
            <polygon points="50,45 76,77 24,77" />
          </g>
          <Face y={63} s={0.75} />
        </>
      )

    case 'cloud':
      return (
        <>
          <Sparkle x={24} y={31} r={4.5} />
          <Sparkle x={79} y={35} r={3.5} />
          <circle cx="35" cy="60" r="14.5" fill="#fff" />
          <circle cx="52" cy="50" r="19.5" fill="#fff" />
          <circle cx="68" cy="61" r="13.5" fill="#fff" />
          <rect x="35" y="56" width="33" height="18.5" rx="9" fill="#fff" />
          <Face y={61} s={0.82} />
        </>
      )

    case 'lollipop':
      return (
        <>
          <rect x="47.2" y="62" width="5.6" height="26" rx="2.8" fill="#fae8ff" />
          <circle cx="50" cy="46" r="24" fill="#fff" />
          <circle cx="50" cy="46" r="18.5" fill="none" stroke="#f0abfc" strokeWidth="4" strokeDasharray="15 10" strokeLinecap="round" />
          <Face y={48} s={0.74} />
        </>
      )

    case 'robot':
      return (
        <>
          <path d="M50 35 V25" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="50" cy="22" r="5" fill="#fde047" />
          <rect x="20" y="49" width="9" height="15" rx="4.5" fill="#cbd5e1" />
          <rect x="71" y="49" width="9" height="15" rx="4.5" fill="#cbd5e1" />
          <rect x="27" y="34" width="46" height="43" rx="14" fill="#f1f5f9" />
          <Face y={57} s={0.88} mood="open" />
        </>
      )

    case 'heart':
      return (
        <>
          <path d="M50 82 C18 61 21 31 40 31 C46 31 50 36 50 41 C50 36 54 31 60 31 C79 31 82 61 50 82 Z" fill="#fff1f2" />
          <Face y={52} s={0.82} mood="wink" />
        </>
      )

    case 'bulb':
      return (
        <>
          {[-60, -30, 0, 30, 60].map((angle) => (
            <rect key={angle} x="48" y="12" width="4" height="8" rx="2" fill="#fef08a" transform={`rotate(${angle} 50 46)`} />
          ))}
          <rect x="41.5" y="64" width="17" height="14" rx="4.5" fill="#e2e8f0" />
          <path d="M42 70 H58 M42 74 H58" stroke="#94a3b8" strokeWidth="1.6" />
          <circle cx="50" cy="46" r="22.5" fill="#fef9c3" />
          <Face y={48} s={0.82} />
        </>
      )

    case 'leaf':
      return (
        <>
          <path d="M50 18 C76 29 80 61 50 84 C20 61 24 29 50 18 Z" fill="#f0fdf4" />
          <path d="M50 28 V40 M50 70 V78" stroke="#bbf7d0" strokeWidth="2.6" strokeLinecap="round" />
          <Face y={55} s={0.8} />
        </>
      )

    case 'comet':
      return (
        <>
          <g strokeLinejoin="round" strokeWidth="3">
            <polygon points="40,62 10,34 46,44" fill="#fdba74" stroke="#fdba74" opacity="0.85" />
            <polygon points="62,42 36,10 48,46" fill="#fdba74" stroke="#fdba74" opacity="0.85" />
            <polygon points="42,56 12,14 58,42" fill="#ffedd5" stroke="#ffedd5" />
          </g>
          <circle cx="57" cy="60" r="22" fill="#fff7ed" />
          <Face x={57} y={61} s={0.84} mood="open" />
        </>
      )

    case 'royal':
      return (
        <>
          <circle cx="50" cy="63" r="22" fill="#faf5ff" />
          <polygon points="33,45 33,26 43,36 50,22 57,36 67,26 67,45" fill="#fde047" stroke="#fde047" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="50" cy="38" r="3" fill="#f472b6" />
          <circle cx="38" cy="40" r="2" fill="#38bdf8" />
          <circle cx="62" cy="40" r="2" fill="#38bdf8" />
          <Face y={64} s={0.86} />
        </>
      )

    case 'blossom':
      return (
        <>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx="50" cy="35" rx="12" ry="15.5" fill="#fff1f2" transform={`rotate(${angle} 50 54)`} />
          ))}
          <circle cx="50" cy="54" r="14.5" fill="#fef3c7" />
          <Face y={55} s={0.64} />
        </>
      )

    case 'pineapple':
      return (
        <>
          <g fill="#bbf7d0" stroke="#bbf7d0" strokeWidth="3" strokeLinejoin="round">
            <polygon points="50,12 57,36 43,36" />
            <polygon points="34,19 51,38 40,40" />
            <polygon points="66,19 60,40 49,38" />
          </g>
          <clipPath id={`${uid}-pine`}>
            <ellipse cx="50" cy="61" rx="20" ry="23.5" />
          </clipPath>
          <ellipse cx="50" cy="61" rx="20" ry="23.5" fill="#fde047" />
          <g clipPath={`url(#${uid}-pine)`} stroke="#facc15" strokeWidth="1.8">
            {[-27, -9, 9, 27].map((offset) => (
              <React.Fragment key={offset}>
                <path d={`M${20 + offset} 38 L${60 + offset} 86`} />
                <path d={`M${80 - offset} 38 L${40 - offset} 86`} />
              </React.Fragment>
            ))}
          </g>
          <Face y={63} s={0.78} />
        </>
      )

    case 'coolSun':
      return (
        <>
          {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle) => (
            <polygon key={angle} points="50,16 56,30 44,30" fill="#fffbeb" stroke="#fffbeb" strokeWidth="2" strokeLinejoin="round" transform={`rotate(${angle} 50 54)`} />
          ))}
          <circle cx="50" cy="54" r="21.5" fill="#fffbeb" />
          <Face y={54} s={0.9} mood="cool" />
        </>
      )

    case 'octopus':
      return (
        <>
          <circle cx="80" cy="30" r="3" fill="#fff" opacity="0.6" />
          <circle cx="20" cy="38" r="2.2" fill="#fff" opacity="0.5" />
          <g stroke="#c7d2fe" strokeWidth="8" fill="none" strokeLinecap="round">
            <path d="M33 58 Q20 62 17 76" />
            <path d="M67 58 Q80 62 83 76" />
            <path d="M41 64 Q36 76 28 84" />
            <path d="M59 64 Q64 76 72 84" />
            <path d="M50 66 V86" />
          </g>
          <ellipse cx="50" cy="47" rx="25" ry="23" fill="#eef2ff" />
          <Face y={50} s={0.88} mood="open" />
        </>
      )

    case 'sunset':
      return (
        <>
          <clipPath id={`${uid}-sunset`}>
            <rect x="0" y="0" width="100" height="63" />
          </clipPath>
          <g clipPath={`url(#${uid}-sunset)`}>
            {[-60, -30, 0, 30, 60].map((angle) => (
              <rect key={angle} x="47.5" y="27" width="5" height="9" rx="2.5" fill="#fff3bf" transform={`rotate(${angle} 50 63)`} />
            ))}
            <circle cx="50" cy="63" r="23" fill="#fde047" />
          </g>
          <path d="M20 68 H80" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M30 77 H70" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" opacity="0.75" />
          <path d="M41 86 H59" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" opacity="0.5" />
          <Face y={52} s={0.68} />
        </>
      )

    case 'drop':
      return (
        <>
          <path d="M50 16 C60 33 74 46 74 60 C74 74 63 83 50 83 C37 83 26 74 26 60 C26 46 40 33 50 16 Z" fill="#ecfeff" />
          <path d="M35 57 Q35 47 41 41" stroke="#a5f3fc" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Face y={63} s={0.82} />
        </>
      )

    case 'battery':
      return (
        <>
          <rect x="42" y="21" width="16" height="10" rx="4" fill="#d9f99d" />
          <rect x="30" y="28" width="40" height="55" rx="12" fill="#f7fee7" />
          <polygon points="53,35 44,47 50,47 47,56 57,43 51,43" fill="#facc15" stroke="#facc15" strokeWidth="1.5" strokeLinejoin="round" />
          <Face y={67} s={0.78} mood="open" />
        </>
      )

    case 'planet':
      return (
        <>
          <Sparkle x={21} y={27} r={4.5} />
          <Sparkle x={82} y={76} r={3.5} />
          <ellipse cx="50" cy="54" rx="34" ry="9.5" fill="none" stroke="#fde68a" strokeWidth="4.5" transform="rotate(-18 50 54)" />
          <circle cx="50" cy="54" r="20.5" fill="#f5f3ff" />
          <path d="M16 54 A34 9.5 0 0 0 84 54" fill="none" stroke="#fde68a" strokeWidth="4.5" strokeLinecap="round" transform="rotate(-18 50 54)" />
          <Face y={51} s={0.72} />
        </>
      )

    case 'mug':
      return (
        <>
          <path d="M40 31 Q35 25 40 19" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.75" />
          <path d="M54 33 Q49 26 54 19" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.75" />
          <path d="M66 50 C82 50 82 70 66 70" stroke="#fff7ed" strokeWidth="6.5" fill="none" strokeLinecap="round" />
          <rect x="26" y="40" width="42" height="41" rx="12" fill="#fff7ed" />
          <Face x={47} y={61} s={0.85} />
        </>
      )
  }
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatar,
  size = 'md',
  className = ''
}) => {
  // useId incluye ':' y no sirve dentro de url(#...)
  const uid = useId().replace(/:/g, '')
  const knownConfig = AVATAR_CONFIGS[avatar]
  // Las partidas antiguas guardaban un emoji como avatar
  const legacyEmoji = !knownConfig && /[^\x00-\x7F]/.test(avatar) ? avatar : null
  const config = knownConfig || AVATAR_CONFIGS['purple-geo']

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  }

  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-full overflow-hidden shadow-md hover:shadow-lg transition-shadow`}
      style={{ flexShrink: 0 }}
      title={legacyEmoji ? undefined : config.name}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={config.backgroundColor} />
            <stop offset="1" stopColor={config.accentColor} />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="0.28" cy="0.2" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-shadow`} x="-25%" y="-25%" width="150%" height="160%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>
        <rect width="100" height="100" fill={`url(#${uid}-bg)`} />
        <rect width="100" height="100" fill={`url(#${uid}-glow)`} />
        {legacyEmoji ? (
          <text x="50" y="53" fontSize="52" textAnchor="middle" dominantBaseline="central">{legacyEmoji}</text>
        ) : (
          <g filter={`url(#${uid}-shadow)`} transform="translate(50 50) scale(0.9) translate(-50 -52)">
            {renderMascot(config.mascot, uid)}
          </g>
        )}
        <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeOpacity="0.38" strokeWidth="3" />
      </svg>
    </div>
  )
}

export default PlayerAvatar

export { AVATAR_CONFIGS }
