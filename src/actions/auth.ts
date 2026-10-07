'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function sendOtp(formData: FormData) {
  const email = formData.get('email') as string
  const joinCode = formData.get('join_code') as string | null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Ingresa un correo válido.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  if (error) return { error: error.message }

  const cookieStore = await cookies()
  cookieStore.set('pending_email', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  })

  if (joinCode) {
    cookieStore.set('pending_join', joinCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    })
  }

  redirect('/verify')
}

export async function verifyOtp(formData: FormData) {
  const token = formData.get('token') as string
  const cookieStore = await cookies()
  const email = cookieStore.get('pending_email')?.value
  const joinCode = cookieStore.get('pending_join')?.value

  if (!email) redirect('/login')
  if (!token || token.length < 6 || token.length > 8) return { error: 'Código inválido.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })

  if (error) return { error: 'Código incorrecto o expirado.' }

  cookieStore.delete('pending_email')

  // Check if profile setup is needed
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('setup_completed')
      .eq('id', user.id)
      .single()

    // Usuario nuevo: conservar pending_join para reenviarlo a la liga despues del setup.
    if (!profile?.setup_completed) redirect('/setup')
  }

  cookieStore.delete('pending_join')
  if (joinCode) redirect(`/join/${joinCode}`)
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
