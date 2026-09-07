import Link from 'next/link'

export default function Home() {
  return (
    <main>
      <h1>Student Ecosystem</h1>
      <p>Student community + education platform.</p>
      <nav>
        <Link href="/login">Login</Link>{' '}
        <Link href="/register">Create account</Link>
      </nav>
    </main>
  )
}
