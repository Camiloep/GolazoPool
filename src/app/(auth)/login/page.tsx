import { sendOtp } from '@/actions/auth'
import LoginForm from '@/components/auth/LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams

  return (
    <div className="brand-panel rounded-panel p-8">
      <h2 className="brand-display text-2xl font-black text-foreground">Ingresa a tu cuenta</h2>
      <p className="mt-1 text-sm text-muted">
        Te enviaremos un codigo de 6 digitos a tu correo.
      </p>
      <LoginForm action={sendOtp} joinCode={join} />
    </div>
  )
}
