'use client'

import type { PointerEvent, ReactNode, WheelEvent } from 'react'
import { useEffect, useRef } from 'react'

interface Props {
  children: ReactNode
  className?: string
  // Si se indica, al montar (o cambiar) desplaza el item con
  // data-scroll-key={activeKey} para dejarlo centrado a la vista.
  activeKey?: string
}

export default function HorizontalMouseScroll({ children, className, activeKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !activeKey) return

    const active = container.querySelector(`[data-scroll-key="${CSS.escape(activeKey)}"]`)
    if (!(active instanceof HTMLElement)) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const offsetWithinContainer = activeRect.left - containerRect.left + container.scrollLeft
    const target = offsetWithinContainer - (container.clientWidth - activeRect.width) / 2

    container.scrollLeft = Math.max(0, target)
  }, [activeKey])
  const dragStateRef = useRef({
    isPointerDown: false,
    isDragging: false,
    pointerId: null as number | null,
    startX: 0,
    scrollLeft: 0,
    suppressClick: false,
  })

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      !container ||
      container.scrollWidth <= container.clientWidth
    ) {
      return
    }

    dragStateRef.current.isPointerDown = true
    dragStateRef.current.isDragging = false
    dragStateRef.current.pointerId = event.pointerId
    dragStateRef.current.startX = event.clientX
    dragStateRef.current.scrollLeft = container.scrollLeft
    dragStateRef.current.suppressClick = false
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const container = containerRef.current
    const dragState = dragStateRef.current

    if (!container || !dragState.isPointerDown || dragState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragState.startX
    if (!dragState.isDragging && Math.abs(deltaX) > 4) {
      dragState.isDragging = true
      dragState.suppressClick = true
      container.setPointerCapture(event.pointerId)
    }

    if (!dragState.isDragging) {
      return
    }

    container.scrollLeft = dragState.scrollLeft - deltaX
    event.preventDefault()
  }

  function stopDragging(event?: PointerEvent<HTMLDivElement>) {
    const container = containerRef.current
    const dragState = dragStateRef.current

    if (event && dragState.pointerId !== event.pointerId) {
      return
    }

    if (container && dragState.pointerId !== null && container.hasPointerCapture(dragState.pointerId)) {
      container.releasePointerCapture(dragState.pointerId)
    }

    if (dragState.suppressClick) {
      window.setTimeout(() => {
        dragStateRef.current.suppressClick = false
      }, 0)
    }

    dragState.isPointerDown = false
    dragState.isDragging = false
    dragState.pointerId = null
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (!container) return

    const maxScrollLeft = container.scrollWidth - container.clientWidth
    if (maxScrollLeft <= 0) return

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (delta === 0) return

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + delta))
    if (nextScrollLeft === container.scrollLeft) return

    container.scrollLeft = nextScrollLeft
    event.preventDefault()
  }

  return (
    <div
      className={className}
      onClickCapture={event => {
        if (!dragStateRef.current.suppressClick) return

        dragStateRef.current.suppressClick = false
        event.preventDefault()
        event.stopPropagation()
      }}
      onDragStartCapture={event => event.preventDefault()}
      onPointerCancel={stopDragging}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onWheel={handleWheel}
      ref={containerRef}
      style={{ scrollbarWidth: 'none' }}
    >
      {children}
    </div>
  )
}
