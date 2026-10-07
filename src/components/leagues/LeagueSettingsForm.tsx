'use client'

import { saveLeagueSettings } from '@/actions/league-settings'
import {
  CORE_TIE_BREAKER_ORDER,
  DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
  formatPredictionLockWindow,
  getMemberPredictionVisibilityRuleText,
  getPredictionEditRuleText,
  getTieBreakerRuleText,
  MAX_PREDICTION_LOCK_MINUTES,
  normalizeTieBreakerOrder,
  OPTIONAL_TIE_BREAKER_CRITERIA,
  TIE_BREAKER_OPTIONS,
} from '@/lib/league-settings'
import { GENERAL_SCORING_RULE } from '@/lib/predictions'
import type {
  LeaderboardTieBreakerCriterion,
  MemberPredictionViewMode,
  MemberPredictionVisibility,
  PredictionLockMode,
} from '@/lib/types'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type TouchEvent,
} from 'react'
import { createPortal } from 'react-dom'

const subscribeNoop = () => () => {}

interface Props {
  leagueId: string
  initialRules: string
  initialPrizes: string
  initialAllowPredictionEdits: boolean
  initialLockMinutes: number
  initialMemberPredictionVisibility: MemberPredictionVisibility
  initialMemberPredictionViewMode: MemberPredictionViewMode
  initialPredictionLockMode: PredictionLockMode
  initialRequireMatchPredictionForPickVisibility: boolean
  initialTieBreakerOrder: LeaderboardTieBreakerCriterion[]
}

const TIE_BREAKER_ACCENT_CLASSES: Record<LeaderboardTieBreakerCriterion, string> = {
  exact_hits: 'bg-[rgba(0,74,128,0.14)] ring-1 ring-[rgba(0,74,128,0.12)] dark:bg-[rgba(26,107,196,0.42)] dark:ring-[rgba(26,107,196,0.32)]',
  winner_hits: 'bg-[rgba(34,181,91,0.16)] ring-1 ring-[rgba(34,181,91,0.14)] dark:bg-[rgba(34,181,91,0.42)] dark:ring-[rgba(34,181,91,0.32)]',
  draw_hits: 'bg-[rgba(200,200,210,0.65)] ring-1 ring-[rgba(0,74,128,0.1)] dark:bg-[rgba(120,154,184,0.28)] dark:ring-[rgba(80,140,220,0.18)]',
  first_prediction_at: 'bg-[rgba(200,163,58,0.22)] ring-1 ring-[rgba(200,163,58,0.18)] dark:bg-[rgba(200,163,58,0.48)] dark:ring-[rgba(200,163,58,0.36)]',
  goal_difference_hits: 'bg-[rgba(210,100,150,0.18)] ring-1 ring-[rgba(210,100,150,0.14)] dark:bg-[rgba(210,100,150,0.4)] dark:ring-[rgba(210,100,150,0.28)]',
  first_exact_hit_at: 'bg-[rgba(0,74,153,0.1)] ring-1 ring-[rgba(0,74,153,0.1)] dark:bg-[rgba(26,107,196,0.32)] dark:ring-[rgba(26,107,196,0.24)]',
  first_scoring_pick_at: 'bg-[rgba(34,181,91,0.13)] ring-1 ring-[rgba(34,181,91,0.11)] dark:bg-[rgba(34,181,91,0.34)] dark:ring-[rgba(34,181,91,0.24)]',
  total_goals_hits: 'bg-[rgba(204,192,3,0.24)] ring-1 ring-[rgba(200,163,58,0.2)] dark:bg-[rgba(210,200,10,0.44)] dark:ring-[rgba(200,163,58,0.34)]',
  total_goal_error: 'bg-[rgba(200,200,210,0.65)] ring-1 ring-[rgba(0,74,128,0.1)] dark:bg-[rgba(120,154,184,0.28)] dark:ring-[rgba(80,140,220,0.18)]',
}

export default function LeagueSettingsForm({
  leagueId,
  initialRules,
  initialPrizes,
  initialAllowPredictionEdits,
  initialLockMinutes,
  initialMemberPredictionVisibility,
  initialMemberPredictionViewMode,
  initialPredictionLockMode,
  initialRequireMatchPredictionForPickVisibility,
  initialTieBreakerOrder,
}: Props) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) =>
      saveLeagueSettings(formData),
    undefined
  )
  const [rules, setRules] = useState(initialRules)
  const [prizes, setPrizes] = useState(initialPrizes)
  const [allowPredictionEdits, setAllowPredictionEdits] = useState(initialAllowPredictionEdits)
  const [allowMemberPickVisibility, setAllowMemberPickVisibility] = useState(
    initialMemberPredictionVisibility !== 'never'
  )
  const [memberPredictionVisibility, setMemberPredictionVisibility] = useState<MemberPredictionVisibility>(
    initialMemberPredictionVisibility === 'always' ? 'always' : 'after_lock'
  )
  const [memberPredictionViewMode, setMemberPredictionViewMode] = useState<MemberPredictionViewMode>(
    initialMemberPredictionViewMode === 'aggregate'
      ? 'aggregate'
      : initialMemberPredictionViewMode === 'participants'
        ? 'participants'
      : DEFAULT_MEMBER_PREDICTION_VIEW_MODE
  )
  const [predictionLockMode, setPredictionLockMode] = useState<PredictionLockMode>(initialPredictionLockMode)
  const [predictionLockMinutes, setPredictionLockMinutes] = useState(initialLockMinutes)
  const [requireMatchPredictionForPickVisibility, setRequireMatchPredictionForPickVisibility] = useState(
    initialRequireMatchPredictionForPickVisibility
  )
  const [tieBreakerOrder, setTieBreakerOrder] = useState<LeaderboardTieBreakerCriterion[]>(
    normalizeTieBreakerOrder(initialTieBreakerOrder)
  )

  const formRef = useRef<HTMLFormElement>(null)
  const navigateAfterSaveRef = useRef<string | null>(null)

  const currentValues = {
    rules,
    prizes,
    allowPredictionEdits,
    allowMemberPickVisibility,
    memberPredictionVisibility,
    memberPredictionViewMode,
    predictionLockMode,
    predictionLockMinutes,
    requireMatchPredictionForPickVisibility,
    tieBreakerOrder,
  }
  const [savedSnapshot, setSavedSnapshot] = useState(currentValues)
  const isDirty = JSON.stringify(currentValues) !== JSON.stringify(savedSnapshot)

  const currentValuesRef = useRef(currentValues)
  useEffect(() => {
    currentValuesRef.current = currentValues
  })

  const { pendingHref, cancel, proceed, navigateTo } = useUnsavedChanges(isDirty)

  // The sticky bar and dialog are portaled to <body> so `position: fixed` is
  // always relative to the viewport (immune to transformed/filtered ancestors)
  // and never affects the page grid layout. Render only on the client (the
  // portal target does not exist during SSR).
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  // After a successful save, return to a "clean" baseline and resume any
  // navigation that was waiting on the save.
  useEffect(() => {
    if (state?.success) {
      setSavedSnapshot(currentValuesRef.current)
      const target = navigateAfterSaveRef.current
      navigateAfterSaveRef.current = null
      if (target) navigateTo(target)
    } else if (state?.error) {
      // A failed save should not silently navigate away on the next save.
      navigateAfterSaveRef.current = null
    }
  }, [state, navigateTo])

  function discardChanges() {
    setRules(savedSnapshot.rules)
    setPrizes(savedSnapshot.prizes)
    setAllowPredictionEdits(savedSnapshot.allowPredictionEdits)
    setAllowMemberPickVisibility(savedSnapshot.allowMemberPickVisibility)
    setMemberPredictionVisibility(savedSnapshot.memberPredictionVisibility)
    setMemberPredictionViewMode(savedSnapshot.memberPredictionViewMode)
    setPredictionLockMode(savedSnapshot.predictionLockMode)
    setPredictionLockMinutes(savedSnapshot.predictionLockMinutes)
    setRequireMatchPredictionForPickVisibility(savedSnapshot.requireMatchPredictionForPickVisibility)
    setTieBreakerOrder(savedSnapshot.tieBreakerOrder)
  }

  function saveThenLeave() {
    navigateAfterSaveRef.current = pendingHref
    cancel()
    formRef.current?.requestSubmit()
  }

  const [draggedTieBreakerIndex, setDraggedTieBreakerIndex] = useState<number | null>(null)
  const [dropTargetTieBreakerIndex, setDropTargetTieBreakerIndex] = useState<number | null>(null)
  const availableOptionalTieBreakers = TIE_BREAKER_OPTIONS.filter(
    (option) =>
      OPTIONAL_TIE_BREAKER_CRITERIA.includes(option.value) && !tieBreakerOrder.includes(option.value)
  )

  function moveTieBreaker(fromIndex: number, toIndex: number) {
    setTieBreakerOrder((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current
      }

      const next = [...current]
      const [movedCriterion] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, movedCriterion)
      return next
    })
  }

  function resetTieBreakerDragState() {
    setDraggedTieBreakerIndex(null)
    setDropTargetTieBreakerIndex(null)
  }

  function addOptionalTieBreaker(criterion: LeaderboardTieBreakerCriterion) {
    if (!OPTIONAL_TIE_BREAKER_CRITERIA.includes(criterion)) return

    setTieBreakerOrder((current) => {
      if (current.includes(criterion)) return current
      return [...current, criterion]
    })
  }

  function removeOptionalTieBreaker(criterion: LeaderboardTieBreakerCriterion) {
    if (CORE_TIE_BREAKER_ORDER.includes(criterion)) return

    setTieBreakerOrder((current) => current.filter((item) => item !== criterion))
  }

  function handleTieBreakerDragStart(index: number) {
    setDraggedTieBreakerIndex(index)
    setDropTargetTieBreakerIndex(index)
  }

  function handleTieBreakerDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dropTargetTieBreakerIndex !== index) {
      setDropTargetTieBreakerIndex(index)
    }
  }

  function handleTieBreakerDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault()

    if (draggedTieBreakerIndex === null) {
      resetTieBreakerDragState()
      return
    }

    moveTieBreaker(draggedTieBreakerIndex, index)
    resetTieBreakerDragState()
  }

  function findTieBreakerIndexFromPoint(clientX: number, clientY: number) {
    if (typeof document === 'undefined') return null

    const target = document.elementFromPoint(clientX, clientY)
    const element = target?.closest('[data-tie-breaker-index]')
    const value = element?.getAttribute('data-tie-breaker-index')

    if (!value) return null

    const index = Number.parseInt(value, 10)
    return Number.isNaN(index) ? null : index
  }

  function handleTieBreakerTouchStart(index: number) {
    setDraggedTieBreakerIndex(index)
    setDropTargetTieBreakerIndex(index)
  }

  function handleTieBreakerTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (draggedTieBreakerIndex === null) return

    const touch = event.touches[0]
    if (!touch) return

    event.preventDefault()

    const targetIndex = findTieBreakerIndexFromPoint(touch.clientX, touch.clientY)
    if (targetIndex !== null && targetIndex !== dropTargetTieBreakerIndex) {
      setDropTargetTieBreakerIndex(targetIndex)
    }
  }

  function handleTieBreakerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (draggedTieBreakerIndex === null) {
      resetTieBreakerDragState()
      return
    }

    const touch = event.changedTouches[0]
    const targetIndex =
      (touch ? findTieBreakerIndexFromPoint(touch.clientX, touch.clientY) : null) ??
      dropTargetTieBreakerIndex

    if (targetIndex !== null) {
      moveTieBreaker(draggedTieBreakerIndex, targetIndex)
    }

    resetTieBreakerDragState()
  }

  return (
    <>
    <form
      action={formAction}
      className="brand-panel space-y-5 overflow-hidden rounded-panel p-4 sm:p-6"
      id="league-settings-form"
      ref={formRef}
    >
      <input name="league_id" type="hidden" value={leagueId} />

      <div>
        <h2 className="brand-display text-2xl font-black text-foreground">Configuracion de la liga</h2>
        <p className="mt-2 text-sm text-muted">
          Define premios, reglas adicionales y las reglas activables de pronosticos para esta liga.
        </p>
        <p className="brand-panel-soft mt-3 rounded-xl px-3 py-2 text-sm text-muted">
          Regla general: {GENERAL_SCORING_RULE}
        </p>
      </div>

      <label className="block space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Premios</span>
        <textarea
          className="brand-input min-h-28 w-full rounded-xl px-4 py-3 text-sm"
          name="prizes"
          onChange={event => setPrizes(event.target.value)}
          placeholder="Ejemplo: 1er lugar: camiseta oficial. 2do lugar: bono de comida."
          value={prizes}
        />
      </label>

      <label className="block space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Reglas adicionales</span>
        <textarea
          className="brand-input min-h-40 w-full rounded-xl px-4 py-3 text-sm"
          name="rules"
          onChange={event => setRules(event.target.value)}
          placeholder="Ejemplo: si dos jugadores empatan, el premio se divide."
          value={rules}
        />
        <p className="text-xs text-muted">
          La regla de puntaje es global. Aqui solo van reglas extra de esta liga.
        </p>
      </label>

      <label className="block space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Bloqueo de pronosticos</span>
        <select
          className="brand-input h-11 w-full rounded-xl px-4 text-sm font-semibold"
          name="prediction_lock_mode"
          onChange={event => setPredictionLockMode(event.target.value as PredictionLockMode)}
          value={predictionLockMode}
        >
          <option value="per_match">Cerrar cada partido por separado</option>
          <option value="phase_start">Cerrar cada fase con base en su primer partido</option>
          <option value="tournament_start">Cerrar todo el mundial con base en el primer partido</option>
        </select>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="brand-input h-11 w-full rounded-xl px-4 text-sm font-semibold sm:w-28"
            max={MAX_PREDICTION_LOCK_MINUTES}
            min={0}
            name="prediction_lock_minutes"
            onChange={event => setPredictionLockMinutes(Number.parseInt(event.target.value || '0', 10) || 0)}
            type="number"
            value={predictionLockMinutes}
          />
          <span className="text-sm text-muted">
            minutos antes de{' '}
            {predictionLockMode === 'tournament_start'
              ? 'que arranque el mundial'
              : predictionLockMode === 'phase_start'
                ? 'que arranque cada fase'
                : 'cada partido'}
          </span>
        </div>
        <p className="text-xs text-muted">
          Usa 0 para cerrar exactamente al inicio. El maximo permitido es {MAX_PREDICTION_LOCK_MINUTES} minutos.
        </p>
        <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
          Vista previa: los pronosticos se cierran {formatPredictionLockWindow(predictionLockMinutes, predictionLockMode)}.
        </p>
      </label>

      <div className="space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Edicion de pronosticos confirmados</span>
        <label className="flex flex-col gap-3 rounded-2xl border border-brand-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Permitir cambios despues de confirmar</p>
            <p className="mt-1 text-xs text-muted">
              Si esta activo, cualquier jugador puede corregir su pick mientras la ventana siga abierta.
            </p>
          </div>
          <span className="relative inline-flex items-center">
            <input
              checked={allowPredictionEdits}
              className="peer sr-only"
              name="allow_prediction_edits"
              onChange={event => setAllowPredictionEdits(event.target.checked)}
              type="checkbox"
            />
            <span className="h-7 w-12 rounded-full bg-brand-line transition peer-checked:bg-brand-green-strong" />
            <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
          </span>
        </label>
        <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
          {getPredictionEditRuleText(allowPredictionEdits)}
        </p>
      </div>

      <div className="space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Visibilidad de picks en la liga</span>
        <label className="flex flex-col gap-3 rounded-2xl border border-brand-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Permitir ver los pronosticos de otros jugadores</p>
            <p className="mt-1 text-xs text-muted">
              Esta regla aplica igual para miembros y administradores de la liga.
            </p>
          </div>
          <span className="relative inline-flex items-center">
            <input
              checked={allowMemberPickVisibility}
              className="peer sr-only"
              name="allow_member_pick_visibility"
              onChange={event => setAllowMemberPickVisibility(event.target.checked)}
              type="checkbox"
            />
            <span className="h-7 w-12 rounded-full bg-brand-line transition peer-checked:bg-brand-green-strong" />
            <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
          </span>
        </label>

        {allowMemberPickVisibility && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">¿Cuando se pueden ver los picks?</p>
              <select
                className="brand-input h-11 w-full rounded-xl px-4 text-sm font-semibold"
                name="member_prediction_visibility"
                onChange={event => setMemberPredictionVisibility(event.target.value as MemberPredictionVisibility)}
                value={memberPredictionVisibility}
              >
                <option value="after_lock">Solo cuando ya cerro el pronostico del partido</option>
                <option value="always">Siempre, incluso con el pronostico abierto</option>
              </select>
              <p className="text-xs text-muted">
                Controla el momento en que un jugador puede ver los picks de los demas. Con la
                opcion de cierre, mientras un partido siga abierto solo se muestra quienes ya
                enviaron su pick (sin el marcador).
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">¿Que se muestra de cada jugador?</p>
              <select
                className="brand-input h-11 w-full rounded-xl px-4 text-sm font-semibold"
                name="member_prediction_view_mode"
                onChange={event => setMemberPredictionViewMode(event.target.value as MemberPredictionViewMode)}
                value={memberPredictionViewMode}
              >
                <option value="detail">El marcador que puso cada jugador</option>
                <option value="participants">Solo quienes ya pronosticaron (sin el marcador)</option>
                <option value="aggregate">Solo la distribucion de marcadores (sin nombres)</option>
              </select>
              <p className="text-xs text-muted">
                Define el nivel de detalle visible de los pronosticos ajenos.
              </p>
            </div>

            <label className="flex flex-col gap-3 rounded-2xl border border-brand-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Exigir pick propio antes de ver ajenos</p>
                <p className="mt-1 text-xs text-muted">
                  El jugador debe haber enviado su pronostico del partido actual antes de ver los demas.
                </p>
              </div>
              <span className="relative inline-flex items-center">
                <input
                  checked={requireMatchPredictionForPickVisibility}
                  className="peer sr-only"
                  name="require_match_prediction_for_pick_visibility"
                  onChange={event => setRequireMatchPredictionForPickVisibility(event.target.checked)}
                  type="checkbox"
                />
                <span className="h-7 w-12 rounded-full bg-brand-line transition peer-checked:bg-brand-green-strong" />
                <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
              </span>
            </label>
          </div>
        )}

        <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
          {getMemberPredictionVisibilityRuleText({
            memberPredictionViewMode:
              allowMemberPickVisibility ? memberPredictionViewMode : DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
            memberPredictionVisibility:
              allowMemberPickVisibility ? memberPredictionVisibility : 'never',
            predictionLockMinutes,
            predictionLockMode,
            requireMatchPredictionForPickVisibility:
              allowMemberPickVisibility && requireMatchPredictionForPickVisibility,
          })}
        </p>
      </div>

      <div className="space-y-2">
        <span className="brand-display text-sm font-bold text-foreground">Desempates de la tabla</span>
        <div className="space-y-3 rounded-2xl border border-brand-line px-3 py-4 sm:px-4">
          <p className="text-sm text-muted">
            Los puntos siguen siendo el criterio principal. Por defecto la liga usa 4 criterios base y puedes sumar desempates opcionales si quieres afinar mas.
          </p>
          <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
            Base: Marcadores exactos, Aciertos al ganador, Aciertos a empates y Primero en realizar la prediccion.
          </p>

          {tieBreakerOrder.map((criterion, index) => {
            const option = TIE_BREAKER_OPTIONS.find((item) => item.value === criterion)
            const accentClass = TIE_BREAKER_ACCENT_CLASSES[criterion]
            const isDragged = draggedTieBreakerIndex === index
            const isDropTarget = dropTargetTieBreakerIndex === index && draggedTieBreakerIndex !== null
            const isCoreCriterion = CORE_TIE_BREAKER_ORDER.includes(criterion)

            return (
              <div
                key={criterion}
                data-tie-breaker-index={index}
                className={[
                  'cursor-grab rounded-[1.75rem] border bg-(--brand-panel-strong) px-4 py-4 shadow-(--brand-shadow-sm) transition active:cursor-grabbing sm:px-5 sm:py-5',
                  isDragged ? 'scale-[0.99] border-brand-green-strong opacity-75' : 'border-brand-line-strong',
                  isDropTarget ? 'border-brand-blue ring-2 ring-[rgba(0,74,153,0.08)]' : '',
                ].join(' ')}
                draggable
                onDragEnd={resetTieBreakerDragState}
                onDragOver={event => handleTieBreakerDragOver(event, index)}
                onDragStart={() => handleTieBreakerDragStart(index)}
                onDrop={event => handleTieBreakerDrop(event, index)}
                title={option?.description}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div
                      aria-label={`Reordenar criterio ${index + 1}`}
                      className="flex shrink-0 touch-none items-center gap-3 text-muted"
                      onTouchCancel={resetTieBreakerDragState}
                      onTouchEnd={handleTieBreakerTouchEnd}
                      onTouchMove={handleTieBreakerTouchMove}
                      onTouchStart={() => handleTieBreakerTouchStart(index)}
                    >
                      <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
                        {Array.from({ length: 6 }, (_value, dotIndex) => (
                          <span key={dotIndex} className="h-1 w-1 rounded-full bg-[rgba(0,74,153,0.28)]" />
                        ))}
                      </span>
                      <span className="brand-display text-base font-bold text-brand-blue">
                        {index + 1}
                      </span>
                    </div>

                    <span className={`h-8 w-8 shrink-0 rounded-full ${accentClass}`} aria-hidden="true" />

                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
                        {option?.label ?? criterion}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {isCoreCriterion ? 'Criterio base' : 'Criterio opcional'}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                    {!isCoreCriterion && (
                      <button
                        className="brand-button-ghost rounded-xl border border-brand-line px-3 py-2 text-xs font-semibold"
                        onClick={() => removeOptionalTieBreaker(criterion)}
                        type="button"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="rounded-2xl border border-dashed border-brand-line px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Criterios opcionales</p>
            <p className="mt-1 text-xs text-muted">
              Agrega solo los que te interesen. Tambien quedaran dentro del orden arrastrable.
            </p>

            {availableOptionalTieBreakers.length === 0 ? (
              <p className="mt-3 text-xs text-muted">Todos los criterios opcionales ya estan activos.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableOptionalTieBreakers.map((option) => (
                  <button
                    key={option.value}
                    className="brand-button-secondary max-w-full rounded-full px-3 py-2 text-left text-xs font-semibold whitespace-normal"
                    onClick={() => addOptionalTieBreaker(option.value)}
                    type="button"
                  >
                    + {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tieBreakerOrder.map((criterion, index) => (
            <input
              key={`tie-breaker-input-${criterion}`}
              name={`tie_breaker_${index + 1}`}
              type="hidden"
              value={criterion}
            />
          ))}
          <input name="tie_breaker_count" type="hidden" value={tieBreakerOrder.length} />
        </div>

        <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
          {getTieBreakerRuleText(tieBreakerOrder)}
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          className="brand-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {state?.success && <p className="text-sm font-semibold text-brand-green-strong">Configuracion guardada.</p>}
      </div>

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>

    {mounted && createPortal(
    <>
    {isDirty && (
      <div className="fixed inset-x-0 bottom-0 z-40 p-0 sm:p-4">
        <div className="brand-gradient mx-auto flex max-w-3xl flex-col gap-3 rounded-t-2xl border-t border-white/15 px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:px-5">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white" aria-hidden="true" />
            Tienes cambios sin guardar
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              disabled={pending}
              onClick={discardChanges}
              type="button"
            >
              Descartar
            </button>
            <button
              className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-blue-strong shadow-sm transition hover:bg-white/90 disabled:opacity-50"
              disabled={pending}
              form="league-settings-form"
              type="submit"
            >
              {pending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    )}

    {pendingHref && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="brand-panel w-full max-w-sm rounded-panel p-5">
          <h3 className="brand-display text-lg font-black text-foreground">Tienes cambios sin guardar</h3>
          <p className="mt-2 text-sm text-muted">¿Deseas guardar antes de salir?</p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              className="brand-button-primary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              disabled={pending}
              onClick={saveThenLeave}
              type="button"
            >
              {pending ? 'Guardando...' : 'Guardar y salir'}
            </button>
            <button
              className="brand-button-ghost rounded-xl border border-brand-line px-4 py-2.5 text-sm font-semibold"
              onClick={proceed}
              type="button"
            >
              Salir sin guardar
            </button>
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-foreground"
              onClick={cancel}
              type="button"
            >
              Seguir editando
            </button>
          </div>
        </div>
      </div>
    )}
    </>,
    document.body
    )}
    </>
  )
}
