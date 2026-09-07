import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Student Ecosystem',
  description: 'Student community and education platform',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
