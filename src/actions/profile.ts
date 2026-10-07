'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function setupProfile(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  if (!name || name.length < 2) return { error: 'El nombre debe tener al menos 2 caracteres.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ name, setup_completed: true })
    .eq('id', user.id)

  if (error) return { error: 'No se pudo guardar el nombre.' }

  // Si venia de un link de invitacion, reenviarlo a la liga tras completar el perfil.
  const cookieStore = await cookies()
  const joinCode = cookieStore.get('pending_join')?.value
  cookieStore.delete('pending_join')

  revalidatePath('/')
  if (joinCode) redirect(`/join/${joinCode}`)
  redirect('/dashboard')
}
