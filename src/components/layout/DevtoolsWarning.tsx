'use client'

import { useEffect } from 'react'

// Self-XSS protection: a styled warning printed to the browser console to deter
// users from pasting code an attacker told them to run. Printed once per full
// page load (the module-level flag avoids React StrictMode double-invokes).
let shown = false

export default function DevtoolsWarning() {
  useEffect(() => {
    if (shown) return
    shown = true

    console.log(
      '%c¡Detente!',
      'color:#e11d48;font-size:44px;font-weight:900;-webkit-text-stroke:1px #fff;'
    )
    console.log(
      '%cEsta es una funcion del navegador pensada para desarrolladores.',
      'color:#004a99;font-size:16px;font-weight:700;'
    )
    console.log(
      '%cSi alguien te pidio copiar y pegar algo aqui para "activar" una funcion o entrar a la cuenta de otra persona, es una estafa y le dara acceso a tu cuenta de GolazoPool.',
      'color:#13253d;font-size:14px;'
    )
  }, [])

  return null
}
