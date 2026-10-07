import BrandMark from '@/components/layout/BrandMark'
import LegalLinks from '@/components/legal/LegalLinks'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark align="center" size="md" />
        </div>
        {children}
        <LegalLinks className="mt-6" />
      </div>
    </div>
  )
}
