import { verifyOtp } from '@/actions/auth'
import VerifyForm from '@/components/auth/VerifyForm'

export default function VerifyPage() {
  return (
    <div className="brand-panel rounded-panel p-8">
      <h2 className="brand-display text-2xl font-black text-foreground">Ingresa el codigo</h2>
      <p className="mt-1 text-sm text-muted">
        Revisa tu correo y escribe el codigo de 6 digitos que te enviamos.
      </p>
      <VerifyForm action={verifyOtp} />
    </div>
  )
}
