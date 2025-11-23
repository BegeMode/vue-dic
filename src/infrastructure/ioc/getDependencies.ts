// Требуется один раз подключить 'reflect-metadata' на старте приложения,
// и включить в tsconfig:
//   "experimentalDecorators": true,
//   "emitDecoratorMetadata": true

/** ---- Типы (минимальные, без зависимостей от 'inversify') ---- */
export type MetadataEntry = {
  key: string | symbol
  value: unknown
}

export type CtorTarget = {
  kind: 'ctor'
  index: number
  serviceIdentifier: unknown
  metadata: MetadataEntry[]
}

export type PropTarget = {
  kind: 'prop'
  propertyKey: string | symbol
  serviceIdentifier: unknown
  metadata: MetadataEntry[]
}

export type DependencyTargets = {
  ctor: CtorTarget[]
  props: PropTarget[]
}

// Если хотите подключать контейнер для проверки isBound / get — опишем минимальный интерфейс:
export type ContainerLike = {
  isBound: (id: unknown) => boolean
  get: <T = unknown>(id: unknown) => T
}

/** ---- Ключи reflect-metadata, используемые Inversify v7 ---- */
const CLASS_METADATA_KEY = '@inversifyjs/core/classMetadataReflectKey'

/** ---------------------- Базовые извлекатели ---------------------- */

/** Возвращает ctor-таргеты: зависимость на каждом параметре конструктора. */
function getCtorTargets(target: Function): CtorTarget[] {
  const metadata = Reflect.getMetadata(CLASS_METADATA_KEY, target)

  if (!metadata?.constructorArguments) {
    return []
  }

  const result: CtorTarget[] = []

  for (let index = 0; index < metadata.constructorArguments.length; index++) {
    const arg = metadata.constructorArguments[index]

    // Структура inversify v7: { kind: 1, optional: false, tags: {}, value: Symbol(Logger) }
    if (arg?.value) {
      result.push({
        kind: 'ctor',
        index,
        serviceIdentifier: arg.value,
        metadata: []
      })
    }
  }

  return result
}

/** Возвращает property-таргеты: зависимость на каждом свойстве с @inject/@multiInject. */
function getPropTargets(target: Function): PropTarget[] {
  const metadata = Reflect.getMetadata(CLASS_METADATA_KEY, target)

  if (!metadata?.properties) {
    return []
  }

  const result: PropTarget[] = []

  // В inversify v7 properties это Map
  for (const [propertyKey, propertyMetadata] of metadata.properties) {
    // Структура аналогична конструктору: { kind: 1, optional: false, tags: {}, value: Symbol }
    if (propertyMetadata?.value) {
      result.push({
        kind: 'prop',
        propertyKey,
        serviceIdentifier: propertyMetadata.value,
        metadata: []
      })
    }
  }

  return result
}

/** ----------------------- Публичные API ----------------------- */

/**
 * Полный разбор зависимостей класса: ctor + props, со всеми метаданными.
 */
export function getDependenciesSafe(target: Function): DependencyTargets {
  return {
    ctor: getCtorTargets(target),
    props: getPropTargets(target)
  }
}

/**
 * Плоский список ID зависимостей (уникальный), без разделения ctor/props.
 */
export function getDependencyIdentifiersSafe(target: Function): unknown[] {
  const { ctor, props } = getDependenciesSafe(target)
  const all = [...ctor.map((t) => t.serviceIdentifier), ...props.map((t) => t.serviceIdentifier)]
  const seen = new Set<unknown>()
  const uniq: unknown[] = []
  for (const id of all) {
    if (!seen.has(id)) {
      seen.add(id)
      uniq.push(id)
    }
  }
  return uniq
}

/**
 * Возвращает плоский список идентификаторов зависимостей (уникальный).
 * В inversify v7 фильтрация @optional/@unmanaged происходит на уровне метаданных.
 */
export function getPreloadableIdentifiers(target: Function): unknown[] {
  const metadata = Reflect.getMetadata(CLASS_METADATA_KEY, target)

  if (!metadata) {
    return []
  }

  const all: unknown[] = []

  // Добавляем зависимости конструктора
  if (metadata.constructorArguments) {
    for (const arg of metadata.constructorArguments) {
      if (arg?.value && !arg.optional) {
        // Исключаем optional
        all.push(arg.value)
      }
    }
  }

  // Добавляем зависимости свойств
  if (metadata.properties) {
    for (const [, propertyMetadata] of metadata.properties) {
      if (propertyMetadata?.value && !propertyMetadata.optional) {
        // Исключаем optional
        all.push(propertyMetadata.value)
      }
    }
  }

  // Убираем дубликаты
  const seen = new Set<unknown>()
  return all.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
}

/**
 * Утилита прелоада: берёт preloadable-ID, проверяет в контейнере isBound, и подгружает отсутствующие.
 * Функция загрузки `loader` должна сама регистрировать binding в контейнере (или возвращать
 * зарегистрированный binding), после чего можно безопасно вызывать container.get(id).
 */
export async function preloadMissing(
  target: Function,
  container: ContainerLike,
  loader: (id: unknown) => Promise<void> | void
): Promise<void> {
  const ids = getPreloadableIdentifiers(target)

  for (const id of ids) {
    if (!container.isBound(id)) {
      await loader(id)
    }
  }
}

/**
 * Вариант прелоада «полный цикл»: загрузить всё отсутствующее и тут же прогреть резолюцию (get).
 * Подходит, если вы хотите не только зарегистрировать, но и сразу создать singletons.
 */
export async function preloadAndWarmup(
  target: Function,
  container: ContainerLike,
  loader: (id: unknown) => Promise<void> | void
): Promise<void> {
  const ids = getPreloadableIdentifiers(target)

  for (const id of ids) {
    if (!container.isBound(id)) {
      await loader(id)
    }
    // прогрев резолюции (создаст singleton, выполнит onActivation, и т.д.)
    try {
      container.get(id)
    } catch {
      // если binding ленивый/динамический и ещё не готов — оставляем как есть
      // (можно логировать по желанию)
    }
  }
}
