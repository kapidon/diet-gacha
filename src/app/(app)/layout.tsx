import Link from 'next/link'
import { SignOutButton } from './_components/sign-out-button'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <nav className="mb-6 flex items-center gap-4 border-b pb-2">
        <Link href="/">今日</Link>
        <Link href="/habits">習慣</Link>
        <SignOutButton />
      </nav>
      {children}
    </div>
  )
}
