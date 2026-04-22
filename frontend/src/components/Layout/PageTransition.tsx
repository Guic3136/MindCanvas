import { ReactNode } from 'react'

interface Props { children: ReactNode }

export default function PageTransition({ children }: Props) {
  return <div className="animate-[slideFadeIn_200ms_ease-out]">{children}</div>
}
