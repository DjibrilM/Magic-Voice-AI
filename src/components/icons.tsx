import * as React from "react"

export function EchoLogo({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`flex items-center gap-2.5 text-white font-bold tracking-tight select-none ${className || ""}`} {...props}>
      <div className="flex size-7 items-center justify-center rounded-lg bg-white/[0.08] border border-white/[0.12] text-white shadow-xs">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          <path d="M7.75 7.75a6 6 0 0 0 0 8.5M16.25 7.75a6 6 0 0 1 0 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
        </svg>
      </div>
      <span className="text-[17px] font-bold tracking-tight text-white">Echo</span>
    </div>
  )
}
export const AppLogo = EchoLogo

export function HomeIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path
        d="M5.81299 12.188H12.188M2.81299 7.70599C2.81299 7.07899 2.81299 6.76599 2.89099 6.47599C2.96099 6.21899 3.07599 5.97599 3.23099 5.75999C3.40499 5.51499 3.64799 5.31699 4.13299 4.91999L6.71999 2.80299C7.53199 2.13799 7.93899 1.80599 8.38999 1.67899C8.7889 1.56664 9.21108 1.56664 9.60999 1.67899C10.061 1.80599 10.467 2.13899 11.28 2.80299L13.867 4.91999C14.352 5.31699 14.595 5.51499 14.769 5.75999C14.924 5.97699 15.039 6.21899 15.109 6.47599C15.188 6.76599 15.188 7.07899 15.188 7.70599V11.588C15.188 12.848 15.188 13.478 14.942 13.959C14.7263 14.3822 14.3822 14.7263 13.959 14.942C13.478 15.188 12.848 15.188 11.588 15.188H6.41299C5.15299 15.188 4.52299 15.188 4.04099 14.942C3.61777 14.7263 3.27368 14.3822 3.05799 13.959C2.81299 13.478 2.81299 12.848 2.81299 11.588V7.70599Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function VoicesIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="5.25" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.75" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.25" cy="12.75" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.75" cy="12.75" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function StudioIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="2.25" y="3" width="13.5" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 7.5L11.25 9L7.5 10.5V7.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function FlowsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="4.5" cy="5.25" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13.5" cy="12.75" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 5.25C9.5 5.25 8.5 12.75 11.5 12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ChatIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M2.25 4.5C2.25 3.67157 2.92157 3 3.75 3H14.25C15.0784 3 15.75 3.67157 15.75 4.5V11.25C15.75 12.0784 15.0784 12.75 14.25 12.75H6L2.25 15.75V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AssetsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M2.25 4.5C2.25 3.67157 2.92157 3 3.75 3H7.125L8.625 5.25H14.25C15.0784 5.25 15.75 5.92157 15.75 6.75V13.5C15.75 14.3284 15.0784 15 14.25 15H3.75C2.92157 15 2.25 14.3284 2.25 13.5V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function TextToSpeechIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className={className} {...props}>
      <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" d="M5.813 2.813v12.375m-3-7.876v3.375M9 5.814v6.375m3.188-7.876v9.375m3-6.374v3.375" />
    </svg>
  )
}

export function VoiceCloningIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M5.0625 7.875C6.6158 7.875 7.875 6.6158 7.875 5.0625C7.875 3.5092 6.6158 2.25 5.0625 2.25C3.5092 2.25 2.25 3.5092 2.25 5.0625C2.25 6.6158 3.5092 7.875 5.0625 7.875Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.0625 15.75C6.6158 15.75 7.875 14.4908 7.875 12.9375C7.875 11.3842 6.6158 10.125 5.0625 10.125C3.5092 10.125 2.25 11.3842 2.25 12.9375C2.25 14.4908 3.5092 15.75 5.0625 15.75Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.9375 7.875C14.4908 7.875 15.75 6.6158 15.75 5.0625C15.75 3.5092 14.4908 2.25 12.9375 2.25C11.3842 2.25 10.125 3.5092 10.125 5.0625C10.125 6.6158 11.3842 7.875 12.9375 7.875Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.9375 15.75C14.4908 15.75 15.75 14.4908 15.75 12.9375C15.75 11.3842 14.4908 10.125 12.9375 10.125C11.3842 10.125 10.125 11.3842 10.125 12.9375C10.125 14.4908 11.3842 15.75 12.9375 15.75Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
export const VoiceCreationIcon = VoiceCloningIcon

export function SoundEffectsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M9 1.5L10.5 6L15 4.5L12 9L16.5 10.5L12 12L13.5 16.5L9 13.5L4.5 16.5L6 12L1.5 10.5L6 9L3 4.5L7.5 6L9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function ImageVideoIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="2.25" y="2.25" width="10.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.25 5.25H15.75V15.75H5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
    </svg>
  )
}

export function VoiceIsolatorIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M2.25 5.25V3.75C2.25 2.92157 2.92157 2.25 3.75 2.25H5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.75 2.25H14.25C15.0784 2.25 15.75 2.92157 15.75 3.75V5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.75 12.75V14.25C15.75 15.0784 15.0784 15.75 14.25 15.75H12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.25 15.75H3.75C2.92157 15.75 2.25 15.0784 2.25 14.25V12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.75 6.75V11.25M9 5.25V12.75M11.25 7.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function VoiceChangerIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M9.29324 5.29431C9.29324 6.727 8.15462 7.88843 6.75003 7.88843C5.34543 7.88843 4.20679 6.727 4.20679 5.29431C4.20679 3.86162 5.34543 2.7002 6.75003 2.7002C8.15462 2.7002 9.29324 3.86162 9.29324 5.29431Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.75005 10.1118C4.58578 10.1118 2.88021 11.2635 1.97847 12.9743C1.37019 14.1283 2.41019 15.3 3.69472 15.3H9.80537C11.0899 15.3 12.1299 14.1283 11.5217 12.9743C10.6199 11.2635 8.91431 10.1118 6.75005 10.1118Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.0569 4.5C15.8143 6.25736 15.8143 9.10656 14.0569 10.864M11.9355 6.62132C12.5214 7.20711 12.5214 8.15685 11.9355 8.74265" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export const VoiceChangingIcon = VoiceChangerIcon

export function MusicIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className={className} {...props}>
      <path d="M7.31299 14.0629C7.31299 15.0979 6.30499 15.9379 5.06299 15.9379C3.81999 15.9379 2.81299 15.0979 2.81299 14.0629C2.81299 13.0279 3.81999 12.1879 5.06299 12.1879C6.30499 12.1879 7.31299 13.0269 7.31299 14.0629ZM7.31299 14.0629V6.00995C7.31287 5.52089 7.47211 5.0451 7.76658 4.65463C8.06106 4.26417 8.47474 3.98028 8.94499 3.84595L12.321 2.88195C12.6558 2.78631 13.0082 2.76968 13.3506 2.83338C13.6929 2.89707 14.0158 3.03936 14.2938 3.24902C14.5718 3.45869 14.7974 3.73002 14.9527 4.04166C15.108 4.3533 15.1889 4.69674 15.189 5.04495V11.8129M15.189 11.8129C15.189 12.8479 14.182 13.6879 12.939 13.6879C11.697 13.6879 10.689 12.8479 10.689 11.8129C10.689 10.7779 11.697 9.93795 12.939 9.93795C14.182 9.93795 15.189 10.7769 15.189 11.8129Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function SongsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="9" cy="9" r="6.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2.25V4.5M9 13.5V15.75M2.25 9H4.5M13.5 9H15.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BeatsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M2.25 9H3.75L5.25 4.5L7.5 13.5L9.75 6L11.25 12L12.75 7.5L14.25 9H15.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5.25" cy="4.5" r="0.75" fill="currentColor" />
      <circle cx="7.5" cy="13.5" r="0.75" fill="currentColor" />
      <circle cx="9.75" cy="6" r="0.75" fill="currentColor" />
      <circle cx="11.25" cy="12" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function SpeechToTextIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M7.797 11.7001H13.047M10.6095 9.0001H13.047M2.25 12.0002C2.25 13.2428 3.25736 14.4001 4.5 14.4001H13.5C14.7426 14.4001 15.75 13.2428 15.75 12.0002V6.00012C15.75 4.75748 14.7426 3.6001 13.5 3.6001H8.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.30711 3.1875C6.06448 4.94486 6.06447 7.7941 4.30711 9.55144M2.18579 5.30882C2.77158 5.8946 2.77158 6.84435 2.18579 7.43014" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function DubbingIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M2.25 4.5C2.25 3.67157 2.92157 3 3.75 3H14.25C15.0784 3 15.75 3.67157 15.75 4.5V11.25C15.75 12.0784 15.0784 12.75 14.25 12.75H6L2.25 15.75V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6.5H11M9 6.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function AudiobooksIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M10.7403 9.4502H6.30255M8.384 6.7502H6.30255M10.4729 2.7002H5.7601C4.56146 2.7002 3.6001 3.38788 3.6001 4.52587V12.1502M3.6001 12.1502V13.7459C3.6001 14.6043 4.29597 15.3002 5.15437 15.3002H9.0001H13.4626C13.9803 15.3002 14.4001 14.8804 14.4001 14.3627V13.0137C14.4001 12.5367 14.0135 12.1502 13.5366 12.1502H9.0001H3.6001Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6196 2.8125C16.377 4.56986 16.377 7.41911 14.6196 9.17649M12.4983 4.93382C13.0841 5.51961 13.0841 6.46935 12.4983 7.05515" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export const StoriesGenerationIcon = AudiobooksIcon

export function MoreToolsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="4.5" cy="9" r="1.25" fill="currentColor" />
      <circle cx="9" cy="9" r="1.25" fill="currentColor" />
      <circle cx="13.5" cy="9" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function VideoCameraIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="2" y="4" width="10" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5L15.2 5.5C15.6 5.25 16 5.5 16 6V12C16 12.5 15.6 12.75 15.2 12.5L12 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AvatarFeatureIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="8" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 15C2.5 12.5 5 11 8 11C11 11 13.5 12.5 13.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 3L15 4.5L16.5 5L15 5.5L14.5 7L14 5.5L12.5 5L14 4.5L14.5 3Z" fill="currentColor" />
      <circle cx="15.5" cy="9" r="0.75" fill="currentColor" />
    </svg>
  )
}


export function DevelopersIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="2.25" y="3" width="13.5" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7L7.5 9L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PaperPlaneIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SidebarToggleIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="2.25" y="3" width="13.5" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.75 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SettingsIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path
        d="M14.1361 3.36144C14.0928 2.92777 14.0711 2.71093 13.9838 2.54161C13.8728 2.32656 13.6877 2.15902 13.4627 2.07005C13.2855 2 13.0676 2 12.6318 2H11.3681C10.9324 2 10.7145 2 10.5374 2.07001C10.3123 2.15898 10.1271 2.32658 10.0162 2.5417C9.9289 2.71098 9.90722 2.92776 9.86387 3.36131C9.78181 4.18195 9.74077 4.59227 9.56907 4.81742C9.35113 5.10319 8.99661 5.25003 8.64044 5.20207C8.35982 5.16427 8.04061 4.9031 7.4022 4.38076C7.06481 4.10472 6.89612 3.9667 6.71463 3.90872C6.48414 3.8351 6.23478 3.84753 6.01277 3.94373C5.83795 4.01947 5.68385 4.17357 5.37566 4.48177L5.37565 4.48177L4.48233 5.37509C4.17403 5.68339 4.01988 5.83754 3.94413 6.01243C3.848 6.23438 3.83557 6.48364 3.90914 6.71405C3.96711 6.89561 4.10516 7.06435 4.38128 7.40182C4.90385 8.04052 5.16514 8.35987 5.20287 8.64066C5.2507 8.99664 5.10395 9.35092 4.81842 9.56881C4.59319 9.74068 4.18264 9.78173 3.36156 9.86384H3.36155H3.36155C2.92777 9.90722 2.71088 9.92891 2.54152 10.0163C2.32654 10.1272 2.15905 10.3123 2.07008 10.5372C2 10.7144 2 10.9324 2 11.3683V12.6318C2 13.0676 2 13.2855 2.07005 13.4627C2.15902 13.6877 2.32656 13.8728 2.54161 13.9838C2.71093 14.0711 2.92776 14.0928 3.36143 14.1361C4.1823 14.2182 4.59273 14.2593 4.81792 14.4311C5.10357 14.649 5.25037 15.0034 5.20247 15.3594C5.16471 15.6402 4.90351 15.9594 4.3811 16.5979C4.10511 16.9352 3.96711 17.1039 3.90913 17.2854C3.8355 17.5159 3.84794 17.7652 3.94414 17.9873C4.01988 18.1621 4.17398 18.3162 4.48217 18.6243L5.37561 19.5178C5.6838 19.826 5.8379 19.9801 6.01272 20.0558C6.23474 20.152 6.4841 20.1645 6.71458 20.0908C6.89607 20.0329 7.06473 19.8949 7.40206 19.6189L7.40208 19.6189C8.04059 19.0964 8.35985 18.8352 8.64057 18.7975C8.99663 18.7496 9.35101 18.8964 9.56892 19.182C9.74072 19.4072 9.78176 19.8176 9.86385 20.6385C9.90722 21.0722 9.92891 21.2891 10.0162 21.4584C10.1272 21.6734 10.3123 21.841 10.5373 21.9299C10.7145 22 10.9324 22 11.3682 22H12.6316C13.0676 22 13.2856 22 13.4628 21.9299C13.6877 21.8409 13.8728 21.6735 13.9837 21.4585C14.0711 21.2891 14.0928 21.0722 14.1362 20.6383C14.2183 19.8173 14.2593 19.4068 14.4311 19.1816C14.649 18.896 15.0034 18.7492 15.3595 18.7971C15.6402 18.8348 15.9594 19.096 16.5979 19.6184L16.5979 19.6184C16.9352 19.8944 17.1039 20.0324 17.2854 20.0904C17.5159 20.164 17.7652 20.1516 17.9873 20.0554C18.1621 19.9796 18.3162 19.8255 18.6243 19.5174L19.5179 18.6238C19.826 18.3157 19.98 18.1617 20.0558 17.9869C20.152 17.7648 20.1645 17.5154 20.0908 17.2848C20.0328 17.1034 19.8949 16.9348 19.619 16.5976C19.0968 15.9593 18.8357 15.6402 18.7979 15.3596C18.7499 15.0034 18.8967 14.6489 19.1825 14.4309C19.4077 14.2592 19.818 14.2182 20.6386 14.1361L20.6386 14.1361C21.0722 14.0928 21.289 14.0711 21.4583 13.9838C21.6734 13.8729 21.841 13.6877 21.93 13.4626C22 13.2855 22 13.0676 22 12.6319V11.3682C22 10.9324 22 10.7145 21.9299 10.5373C21.841 10.3123 21.6734 10.1272 21.4584 10.0162C21.2891 9.92891 21.0722 9.90722 20.6385 9.86385C19.8176 9.78176 19.4072 9.74072 19.182 9.56893C18.8964 9.35102 18.7496 8.99662 18.7975 8.64056C18.8352 8.35984 19.0964 8.0406 19.6188 7.4021C19.8948 7.06478 20.0328 6.89612 20.0908 6.71464C20.1644 6.48415 20.152 6.23478 20.0558 6.01275C19.98 5.83794 19.8259 5.68385 19.5178 5.37567L18.6243 4.4822C18.3161 4.17402 18.162 4.01994 17.9872 3.94419C17.7652 3.84798 17.5158 3.83555 17.2853 3.90918C17.1038 3.96716 16.9352 4.10515 16.5979 4.38113C15.9594 4.90352 15.6402 5.16472 15.3595 5.20248C15.0034 5.25038 14.649 5.10358 14.4311 4.81793C14.2593 4.59274 14.2182 4.1823 14.1361 3.36144ZM16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
