export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
