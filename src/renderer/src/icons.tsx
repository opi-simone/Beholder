import type { JSX, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
  )
}

export function IconGrid(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

export function IconList(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  )
}

export function IconBriefcase(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  )
}

export function IconChart(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </Svg>
  )
}

export function IconGear(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 6.5l1.7 1M17.4 16.5l1.7 1M3 12h2M19 12h2M4.9 17.5l1.7-1M17.4 7.5l1.7-1" />
    </Svg>
  )
}

export function IconSun(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 7.6 7.6M16.4 16.4l1.4 1.4M6.2 17.8 7.6 16.4M16.4 7.6l1.4-1.4" />
    </Svg>
  )
}

export function IconMoon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M16 13a6 6 0 1 1-7-8 7 7 0 0 0 7 8z" />
    </Svg>
  )
}

export function IconPause(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconPlay(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconLock(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function IconClock(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </Svg>
  )
}

export function IconFile(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </Svg>
  )
}

export function IconUser(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.5-3.5 12.5-3.5 14 0" />
    </Svg>
  )
}

export function IconPulse(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </Svg>
  )
}

export function IconHourglass(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 4h12M6 20h12M8 4c0 4 8 4 8 8s-8 4-8 8M16 4c0 4-8 4-8 8s8 4 8 8" />
    </Svg>
  )
}

export function IconChevron(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}

export function IconClassify(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5M12 16h.01" />
    </Svg>
  )
}

export function IconEye(props: IconProps): JSX.Element {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 5c-5 0-9 4.2-10 7 1 2.8 5 7 10 7s9-4.2 10-7c-1-2.8-5-7-10-7zm0 11.2A4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 0 1 0 8.4zm0-2.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" />
    </Svg>
  )
}
