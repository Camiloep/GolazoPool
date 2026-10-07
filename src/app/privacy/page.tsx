import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacidad y tratamiento de datos',
  description: 'Como GolazoPool recopila, usa, conserva y protege datos personales.',
}

const lastUpdated = '11 de mayo de 2026'
const defaultContactEmail = 'golazopool@gmail.com'

const controller = {
  name: process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME?.trim() || 'Titular y operador de GolazoPool',
  email: process.env.NEXT_PUBLIC_DATA_CONTROLLER_EMAIL?.trim() || defaultContactEmail,
  address: process.env.NEXT_PUBLIC_DATA_CONTROLLER_ADDRESS?.trim() || null,
  phone: process.env.NEXT_PUBLIC_DATA_CONTROLLER_PHONE?.trim() || null,
  privacyChannel:
    process.env.NEXT_PUBLIC_DATA_PRIVACY_CONTACT?.trim() ||
    process.env.NEXT_PUBLIC_DATA_CONTROLLER_EMAIL?.trim() ||
    defaultContactEmail,
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:px-8 lg:px-10">
      <div className="brand-panel rounded-panel px-6 py-8 sm:px-10">
        <p className="brand-kicker text-kicker-lg">Legal</p>
        <h1 className="brand-display mt-3 text-4xl font-black text-foreground">
          Politica de privacidad y tratamiento de datos personales
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted sm:text-base">
          Esta politica explica como GolazoPool recolecta, usa, almacena, comparte y protege los
          datos personales de quienes visitan, crean cuentas, administran ligas o participan en
          ellas dentro del servicio.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Ultima actualizacion: {lastUpdated}
        </p>

        <div className="mt-10 space-y-8">
          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              1. Responsable del tratamiento y canal de atencion
            </h2>
            <p className="text-sm text-muted">
              GolazoPool es una plataforma digital para crear y administrar ligas privadas de
              pronosticos deportivos. El responsable del tratamiento de los datos personales es la
              persona que opera esta instancia del servicio y decide sobre sus bases de datos,
              finalidades y canales de atencion.
            </p>
            <div className="brand-panel-soft rounded-2xl px-4 py-4 text-sm text-muted">
              <p>
                <span className="font-semibold text-foreground">Responsable:</span> {controller.name}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Canal para consultas, reclamos y habeas data:</span>{' '}
                {controller.privacyChannel}
              </p>
              {controller.email && (
                <p className="mt-1">
                  <span className="font-semibold text-foreground">Correo:</span> {controller.email}
                </p>
              )}
              {controller.phone && (
                <p className="mt-1">
                  <span className="font-semibold text-foreground">Telefono:</span> {controller.phone}
                </p>
              )}
              {controller.address && (
                <p className="mt-1">
                  <span className="font-semibold text-foreground">Direccion:</span> {controller.address}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              2. A quienes aplica esta politica
            </h2>
            <div className="space-y-3 text-sm text-muted">
              <p>
                Esta politica aplica a visitantes, usuarios registrados, administradores de ligas,
                participantes invitados y, en general, a cualquier titular cuyos datos sean
                tratados mediante formularios, sesiones, canales de soporte o funciones operativas
                de GolazoPool.
              </p>
              <p>
                Para efectos operativos, GolazoPool puede tratar datos en tres contextos
                principales: registro y acceso a la cuenta, administracion de ligas y
                participacion en pronosticos, resultados, rankings y dinamicas internas del
                servicio.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              3. Datos personales que podemos tratar
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>Datos de identificacion y contacto, como correo electronico, nombre o apodo.</li>
              <li>Datos de cuenta y autenticacion, como solicitudes de acceso, inicio de sesion y estado de la cuenta.</li>
              <li>
                Datos de participacion en ligas, membresias, roles, invitaciones, solicitudes de
                ingreso y acciones de administracion.
              </li>
              <li>
                Datos de juego y operacion, como pronosticos, confirmaciones, puntajes, historial
                de resultados y registros necesarios para prestar el servicio.
              </li>
              <li>
                Datos tecnicos de sesion, navegador, dispositivo, rendimiento y navegacion
                estrictamente necesarios para seguridad, continuidad operativa y medicion agregada
                del uso del producto.
              </li>
              <li>
                Informacion que el propio titular entregue voluntariamente a traves de formularios
                habilitados o canales de soporte.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              4. Finalidades del tratamiento
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>Crear, autenticar, recuperar y administrar cuentas de usuario.</li>
              <li>
                Permitir la creacion, configuracion y administracion de ligas privadas, reglas,
                rankings, premios y permisos internos del servicio.
              </li>
              <li>
                Permitir el ingreso a ligas mediante invitacion o codigo, y registrar la relacion
                entre administradores, miembros y participantes.
              </li>
              <li>
                Registrar pronosticos, cierres, resultados, puntajes, desempates y demas dinamicas
                propias de la competencia recreativa.
              </li>
              <li>
                Validar acciones, prevenir accesos no autorizados, detectar abusos, resolver
                incidentes y proteger la integridad del servicio.
              </li>
              <li>
                Atender consultas, solicitudes, quejas, reclamos, revocatorias y requerimientos
                legales o regulatorios aplicables.
              </li>
              <li>
                Generar estadisticas agregadas de uso, navegacion y rendimiento para mejorar la
                experiencia, sin vender datos personales a terceros.
              </li>
              <li>
                Enviar comunicaciones operativas relacionadas con acceso, uso de la cuenta,
                invitaciones, soporte o cambios relevantes del servicio.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              5. Autorizacion, principios y limites del tratamiento
            </h2>
            <div className="space-y-3 text-sm text-muted">
              <p>
                Cuando la ley lo requiera, el tratamiento se realiza con autorizacion previa,
                expresa e informada del titular, o en los eventos en que la normativa permita el
                tratamiento sin ella por existir una relacion contractual, una obligacion legal o
                un interes legitimo compatible con la operacion del servicio.
              </p>
              <p>
                El tratamiento se rige por principios de legalidad, finalidad, libertad,
                veracidad, transparencia, acceso y circulacion restringida, seguridad y
                confidencialidad.
              </p>
              <p>
                GolazoPool no comercializa bases de datos personales ni usa los datos para fines
                incompatibles con los aqui informados. Tampoco solicita deliberadamente datos
                sensibles ni datos de ninos, ninas o adolescentes para el funcionamiento ordinario
                del servicio. Si en un caso excepcional ello llegara a ser necesario, se informara
                previamente su caracter facultativo y el tratamiento aplicable.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              6. Circulacion interna de la informacion dentro de GolazoPool
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                El nombre, apodo, pertenencia a ligas, puntajes, posiciones y otros datos visibles
                del juego pueden ser consultados por administradores y miembros de la liga cuando
                ello sea necesario para la dinamica del servicio.
              </li>
              <li>
                Los administradores de una liga pueden conocer las solicitudes de ingreso, la
                aceptacion de miembros, los resultados internos y la informacion necesaria para
                operar la liga que administran.
              </li>
              <li>
                Las predicciones y resultados pueden permanecer visibles dentro de la liga de
                acuerdo con la logica del producto, los cierres de partido y las reglas internas de
                participacion.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              7. Derechos de los titulares
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>Conocer, actualizar y rectificar sus datos personales.</li>
              <li>Solicitar prueba de la autorizacion otorgada cuando sea procedente.</li>
              <li>Ser informado sobre el uso que se ha dado a sus datos personales.</li>
              <li>
                Revocar la autorizacion y/o solicitar la supresion del dato cuando proceda
                legalmente.
              </li>
              <li>Acceder en forma gratuita a sus datos personales objeto de tratamiento.</li>
              <li>
                Presentar consultas y reclamos ante el responsable y, una vez agotado ese tramite,
                quejas ante la Superintendencia de Industria y Comercio o la autoridad competente.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              8. Consultas, reclamos, supresion y revocatoria
            </h2>
            <div className="space-y-3 text-sm text-muted">
              <p>
                Las solicitudes deben identificar al titular, describir claramente la consulta o
                reclamo y aportar, cuando aplique, la documentacion que soporte la actuacion de su
                representante o causahabiente.
              </p>
              <p>
                Las consultas se atenderan, como regla general, dentro de los diez (10) dias
                habiles siguientes a su recibo, prorrogables por cinco (5) dias habiles mas cuando
                no sea posible responder en el primer termino.
              </p>
              <p>
                Los reclamos se atenderan, como regla general, dentro de los quince (15) dias
                habiles siguientes a su recibo, prorrogables por ocho (8) dias habiles mas cuando
                no sea posible resolverlos oportunamente.
              </p>
              <p>
                La supresion del dato o la revocatoria de la autorizacion procederan cuando sean
                legalmente viables y no exista deber legal o contractual de conservar la
                informacion.
              </p>
              <p>
                El canal habilitado para ejercer estos derechos es: {controller.privacyChannel}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              9. Encargados, transferencias y cumplimiento legal
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Los datos pueden ser tratados por terceros encargados que apoyen la operacion
                tecnica, el soporte, la seguridad, la mensajeria o la continuidad del servicio,
                bajo instrucciones y deberes de confidencialidad.
              </li>
              <li>
                Tambien podran compartirse con autoridades competentes cuando exista deber legal,
                orden judicial o requerimiento valido.
              </li>
              <li>
                Si por razones operativas existieran transmisiones o transferencias nacionales o
                internacionales, estas se realizaran bajo medidas contractuales, tecnicas o legales
                razonables de proteccion y solo para finalidades compatibles con esta politica.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              10. Cookies, sesiones y almacenamiento local
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Usamos cookies tecnicas, tokens de sesion y otros mecanismos equivalentes para
                autenticar el acceso, mantener la cuenta activa y proteger la operacion del sitio.
              </li>
              <li>
                El navegador tambien puede almacenar preferencias o confirmaciones locales, como el
                aviso de cookies, para mejorar la experiencia y evitar mensajes repetidos.
              </li>
              <li>
                Podemos utilizar herramientas de medicion agregada del uso del servicio para
                entender rendimiento, navegacion general y estabilidad del producto, sin que ello
                implique la venta de datos personales.
              </li>
              <li>
                Si deshabilitas cookies o almacenamiento esencial, algunas funciones del servicio
                pueden dejar de operar correctamente.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              11. Conservacion, seguridad y confidencialidad
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Conservamos la informacion mientras sea necesaria para prestar el servicio, atender
                obligaciones legales, resolver controversias o mantener historicos operativos
                compatibles con la finalidad informada.
              </li>
              <li>
                Aplicamos medidas razonables de seguridad tecnica, humana y administrativa para
                reducir riesgos de acceso no autorizado, perdida, alteracion o uso indebido.
              </li>
              <li>
                Solo las personas autorizadas y los encargados que lo requieran para la operacion
                del servicio pueden acceder a los datos dentro de los limites de su funcion.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-display text-2xl font-black text-foreground">
              12. Vigencia y cambios de la politica
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Esta politica rige desde el {lastUpdated} y permanecera vigente mientras exista
                tratamiento de datos personales asociado al servicio o mientras una nueva version la
                reemplace.
              </li>
              <li>
                Cualquier cambio sustancial en la identificacion del responsable o en las
                finalidades del tratamiento sera informado por medios razonables antes de su
                implementacion, cuando ello sea exigible.
              </li>
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link className="brand-button-secondary rounded-xl px-4 py-2 font-semibold" href="/">
          Volver al inicio
        </Link>
        <Link className="brand-link" href="/login">
          Ir a login
        </Link>
      </div>
    </div>
  )
}
