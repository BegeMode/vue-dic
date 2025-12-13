
# Спецификация: Vite-плагин для автоматической регистрации CQRS Query/Command → Store ID

## 0. Цель и результат

Нужно реализовать Vite-плагин `vite-cqrs-register-plugin`, который:

1. Во время сборки (dev и prod) анализирует store-файлы и строит **два словаря**:

```ts
// Query класс → Store ID (string)
type QueriesMap = Map<QueryClass, string>

// Command класс → Store ID (string)  
type CommandsMap = Map<CommandClass, string>
```

2. Автоматически находит связи:
   - вызовы `queryable(QueryClass, action(...))` внутри store → добавляет в QueriesMap
   - вызовы `commandable(CommandClass, action(...))` внутри store → добавляет в CommandsMap
   - Store ID из `defineStore(INFRA_DEPS.StoreName, ...)` или `defineStore(STORE_ID, ...)`

3. Генерирует **два виртуальных модуля**:
   ```ts
   import { queriesRegistry } from 'virtual:queries-registry'
   import { commandsRegistry } from 'virtual:commands-registry'
   ```

4. **Заменяет ручное ведение** файла `src/infrastructure/stores/register.ts`.

> Store загружается через IoC по Store ID — loaders уже описаны в `src/infrastructure/deps.ts`.


### 0.1. Пример результата

Для проекта со stores:
- `counter/counter.ts`: `defineStore(INFRA_DEPS.CounterStore, ...)` с `queryable(CurrentUserQuery, ...)` и `commandable(IncrementCommand, ...)`
- `movies/movies.ts`: `defineStore(INFRA_DEPS.MoviesStore, ...)` с `queryable(MovieListQuery, ...)`
- `date/date.ts`: `defineStore(INFRA_DEPS.DateStore, ...)` с `commandable(DateUpdateCommand, ...)`

Генерируются два модуля:

```ts
// virtual:queries-registry
import { CurrentUserQuery } from '@/domain/queries/user.query'
import { MovieListQuery } from '@/domain/queries/movie.query'

export const queriesRegistry = new Map<Function, string>([
  [CurrentUserQuery, 'CounterStore'],
  [MovieListQuery, 'MoviesStore'],
])
```

```ts
// virtual:commands-registry
import { IncrementCommand } from '@/domain/commands/increment.command'
import { DateUpdateCommand } from '@/domain/commands/date.command'

export const commandsRegistry = new Map<Function, string>([
  [IncrementCommand, 'CounterStore'],
  [DateUpdateCommand, 'DateStore'],
])
```


## 1. Входные параметры плагина

```ts
export interface CqrsRegisterPluginOptions {
  /** Путь к директории со stores (абсолютный или относительный) */
  storesDir: string  // default: 'src/infrastructure/stores'

  /** Паттерн для поиска store файлов (glob) */
  storePattern?: string  // default: '**/[!_]*.ts' (исключает _*.ts)

  /** Исключаемые файлы/папки (glob patterns) */
  exclude?: string[]  // default: ['**/__tests__/**', '**/loader.ts', '**/types.ts']

  /** Массив путей к TS-файлам с export const deps = ... */
  depIdsFiles: string[]

  /** Имя виртуального модуля для queries */
  queriesVirtualModuleId?: string  // default: 'virtual:queries-registry'

  /** Имя виртуального модуля для commands */
  commandsVirtualModuleId?: string  // default: 'virtual:commands-registry'

  /** Логирование в консоль */
  devTelemetry?: boolean  // default: false
}
```

### 1.1. Зависимости плагина

Встроенные возможности Vite/Rollup:
- `this.parse()` — парсинг AST

Внешние зависимости:
- `estree-walker` — обход AST
- `fast-glob` — поиск файлов по паттерну


## 2. Структура store-файла (что анализируем)

### 2.1. Типичный store

```ts
// src/infrastructure/stores/counter/counter.ts
import { defineStore } from 'pinia'
import { queryable } from '@/infrastructure/queries/queryable'
import { commandable } from '@/infrastructure/queries/commandable'
import { CurrentUserQuery } from '@/domain/queries/user.query'
import { IncrementCommand } from '@/domain/commands/increment.command'
import { INFRA_DEPS } from '@/infrastructure/depIds'

const useCounterStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
  // ...
  return {
    increment: commandable(IncrementCommand, action(increment)),
    increment1: queryable(CurrentUserQuery, action(increment1))
  }
})
```

### 2.2. Что извлекаем

1. **Store ID** — первый аргумент `defineStore()`:
   - `INFRA_DEPS.CounterStore` → извлекаем `INFRA_DEPS.CounterStore`
   - `INFRA_DEPS.CounterStore` → используем как есть
   - `'counter'` (строковый литерал) → используем как есть`

2. **Query классы** — первый аргумент `queryable()`

3. **Command классы** — первый аргумент `commandable()`

4. **Import paths** — откуда импортированы Query/Command классы


## 3. Алгоритм работы плагина

### 3.1. Этап buildStart (или configResolved)

1. Сканируем `storesDir` по паттерну `storePattern`
2. Исключаем файлы по `exclude`
3. Для каждого найденного файла:
   - парсим AST
   - извлекаем Store ID, Queries, Commands

### 3.2. Парсинг store файла

Для каждого файла:

1. **Собираем импорты** — строим карту `LocalName → ImportInfo`:
   ```ts
   interface ImportInfo {
     originalName: string   // оригинальное имя (для aliased imports)
     importPath: string     // путь импорта
   }
   
   // import { CurrentUserQuery } from '@/domain/queries/user.query'
   importMap['CurrentUserQuery'] = { 
     originalName: 'CurrentUserQuery', 
     importPath: '@/domain/queries/user.query' 
   }
   
   // import { INFRA_DEPS } from '@/infrastructure/depIds'
   importMap['INFRA_DEPS'] = {
     originalName: 'INFRA_DEPS',
     importPath: '@/infrastructure/depIds'
   }
   ```

2. **Ищем `defineStore(STORE_ID, ...)`**:
   - `CallExpression` с `callee.name === 'defineStore'`
   - Первый аргумент:
     - `MemberExpression`: `INFRA_DEPS.CounterStore` → `INFRA_DEPS.CounterStore`
     - `Literal`: `'counter'` → `'counter'`

3. **Ищем вызовы `queryable(X, ...)` и `commandable(X, ...)`**:
   - `CallExpression` с `callee.name === 'queryable'` или `'commandable'`
   - Первый аргумент — `Identifier` с именем Query/Command класса
   - По `importMap` получаем путь импорта

### 3.3. Результат парсинга

```ts
interface StoreInfo {
  storeId: string              // 'CounterStore' или "counter"'
  queries: CqrsEntry[]
  commands: CqrsEntry[]
}

interface CqrsEntry {
  className: string            // 'CurrentUserQuery'
  importPath: string           // '@/domain/queries/user.query'
}

const stores: StoreInfo[] = []
```


## 4. Генерация виртуальных модулей

### 4.1. IDs

```ts
const QUERIES_VIRTUAL_ID = options.queriesVirtualModuleId ?? 'virtual:queries-registry'
const COMMANDS_VIRTUAL_ID = options.commandsVirtualModuleId ?? 'virtual:commands-registry'
const RESOLVED_QUERIES_ID = '\0' + QUERIES_VIRTUAL_ID
const RESOLVED_COMMANDS_ID = '\0' + COMMANDS_VIRTUAL_ID
```

### 4.2. Hooks

- `resolveId(id)`:
  - если `id === QUERIES_VIRTUAL_ID` → return `RESOLVED_QUERIES_ID`
  - если `id === COMMANDS_VIRTUAL_ID` → return `RESOLVED_COMMANDS_ID`

- `load(id)`:
  - если `id === RESOLVED_QUERIES_ID` → генерируем модуль queries
  - если `id === RESOLVED_COMMANDS_ID` → генерируем модуль commands

### 4.3. Генерация кода для queries

```ts
function generateQueriesModule(stores: StoreInfo[]): string {
  const imports = new Set<string>()
  const entries: string[] = []
  
  for (const store of stores) {
    for (const query of store.queries) {
      imports.add(`import { ${query.className} } from '${query.importPath}'`)
      entries.push(`[${query.className}, ${store.storeId}]`)
    }
  }
  
  return `
${[...imports].join('\n')}

export const queriesRegistry = new Map<Function, string>([
  ${entries.join(',\n  ')}
])
`
}
```

### 4.4. Генерация кода для commands

```ts
function generateCommandsModule(stores: StoreInfo[]): string {
  const imports = new Set<string>()
  const entries: string[] = []
  
  for (const store of stores) {
    for (const command of store.commands) {
      imports.add(`import { ${command.className} } from '${command.importPath}'`)
      entries.push(`[${command.className}, ${store.storeId}]`)
    }
  }
  
  return `
${[...imports].join('\n')}

export const commandsRegistry = new Map<Function, string>([
  ${entries.join(',\n  ')}
])
`
}
```


## 5. Использование в QueryInvoker / CommandInvoker

### 5.1. Изменение QueryInvoker

```ts
// src/domain/queries/queryInvoker.ts
import { queriesRegistry } from 'virtual:queries-registry'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'
import { container } from '@/infrastructure/ioc/container'

@injectable()
export class QueryInvoker<TResult> implements IQueryInvoker<TResult> {
  public async exec(query: IQuery<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)
    
    // Получаем Store ID из registry
    const storeId = queriesRegistry.get(proto.constructor)
    if (storeId) {
      // Загружаем store через IoC (если ещё не загружен)
      await getServiceAsync(storeId, container)
    }
    
    const action = Reflect.getMetadata(proto, QueryBase)
    return action(query)
  }
}
```

### 5.2. Изменение CommandInvoker

```ts
// src/domain/commands/commandInvoker.ts
import { commandsRegistry } from 'virtual:commands-registry'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'
import { container } from '@/infrastructure/ioc/container'

@injectable()
export class CommandInvoker<TResult> implements ICommandInvoker<TResult> {
  public async exec(command: ICommand<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(command)
    
    // Получаем Store ID из registry
    const storeId = commandsRegistry.get(proto.constructor)
    if (storeId) {
      // Загружаем store через IoC (если ещё не загружен)
      await getServiceAsync(storeId, container)
    }
    
    const action = Reflect.getMetadata(proto, CommandBase)
    return action(command)
  }
}
```


## 6. Hot Module Replacement (HMR)

### 6.1. Отслеживание изменений

В dev режиме плагин должен:

1. Следить за изменениями в `storesDir`
2. При изменении store файла:
   - перепарсить файл
   - обновить registry
   - инвалидировать виртуальный модуль

### 6.2. Реализация

```ts
configureServer(server) {
  server.watcher.on('change', (file) => {
    if (isStoreFile(file)) {
      updateRegistry(file)
      
      // Инвалидируем оба виртуальных модуля
      const queriesMod = server.moduleGraph.getModuleById(RESOLVED_QUERIES_ID)
      const commandsMod = server.moduleGraph.getModuleById(RESOLVED_COMMANDS_ID)
      
      if (queriesMod) {
        server.moduleGraph.invalidateModule(queriesMod)
      }
      if (commandsMod) {
        server.moduleGraph.invalidateModule(commandsMod)
      }
    }
  })
}
```


## 7. Обработка ошибок

### 7.1. Store ID не найден

Если `defineStore(...)` не найден в файле:
- **error** в консоль
- останавливаем сборку

### 7.2. Query/Command не импортирован

Если `queryable(SomeQuery, ...)` но `SomeQuery` не найден в импортах:
- **error** в консоль
- останавливаем сборку


## 8. Использование плагина

### 8.1. Конфигурация Vite

```ts
// vite.config.ts
import { cqrsRegisterPlugin } from './lib/vite-cqrs-register-plugin'

export default defineConfig({
  plugins: [
    cqrsRegisterPlugin({
      storesDir: 'src/infrastructure/stores',
      depIdsFiles: [
        'src/domain/depIds.ts',
        'src/application/depIds.ts', 
        'src/infrastructure/depIds.ts',
        'src/ui/depIds.ts'
      ],
      devTelemetry: true
    })
  ]
})
```

### 8.2. TypeScript декларации

```ts
// src/vite-env.d.ts
declare module 'virtual:queries-registry' {
  export const queriesRegistry: Map<Function, string>
}

declare module 'virtual:commands-registry' {
  export const commandsRegistry: Map<Function, string>
}
```


## 9. Поведение в разных режимах

| Режим | Поведение |
|-------|-----------|
| `vite dev` | Сканирует при старте + HMR при изменениях |
| `vite build` | Сканирует один раз, генерирует код в бандл |
| `vite preview` | Использует сгенерированный код из build |


## 10. Логирование и отладка

Если `devTelemetry: true`:

```
[vite-cqrs-register] Scanning stores in: src/infrastructure/stores
[vite-cqrs-register] Found 3 store files

[vite-cqrs-register] counter/counter.ts (INFRA_DEPS.CounterStore):
  Queries:
    - CurrentUserQuery
  Commands:
    - IncrementCommand

[vite-cqrs-register] movies/movies.ts (INFRA_DEPS.MoviesStore):
  Queries:
    - MovieListQuery

[vite-cqrs-register] date/date.ts (INFRA_DEPS.DateStore):
  Commands:
    - DateUpdateCommand

[vite-cqrs-register] Total: 2 queries, 2 commands
```


## 11. Acceptance criteria / тесты

### 11.1. Unit-тесты (vitest)

1. **Парсинг импортов**
   - `import { X } from 'path'` → `importMap['X'] = { originalName: 'X', importPath: 'path' }`
   - `import { X as Y } from 'path'` → `importMap['Y'] = { originalName: 'X', importPath: 'path' }`

2. **Парсинг Store ID**
   - `defineStore(INFRA_DEPS.CounterStore, ...)` → `INFRA_DEPS.CounterStore`
   - `defineStore('counter', ...)` → `'counter'`

3. **Парсинг queryable/commandable**
   - `queryable(CurrentUserQuery, action(fn))` → добавляется в queries
   - `commandable(IncrementCommand, action(fn))` → добавляется в commands
   - вложенные вызовы внутри return statement — находятся

4. **Генерация виртуальных модулей**
   - `virtual:queries-registry` экспортирует только `queriesRegistry`
   - `virtual:commands-registry` экспортирует только `commandsRegistry`
   - каждый модуль содержит только нужные импорты
   - синтаксически валидный TypeScript

5. **Раздельность модулей**
   - Query попадает только в `virtual:queries-registry`
   - Command попадает только в `virtual:commands-registry`

### 11.2. Интеграционный тест

1. Создать тестовый проект с 3 stores
2. Запустить vite build
3. Проверить что `virtual:queries-registry` экспортирует `queriesRegistry`
4. Проверить что `virtual:commands-registry` экспортирует `commandsRegistry`
5. Проверить что `queriesRegistry.get(MovieListQuery) === 'MoviesStore'`
6. Проверить что `commandsRegistry.get(IncrementCommand) === 'CounterStore'`


## 12. Структура файлов

```
lib/
  vite-cqrs-register-plugin/
    index.ts                  # главный файл плагина
    parseStore.ts             # парсинг store файла
    generateModule.ts         # генерация виртуального модуля
    types.ts                  # типы
    vite-cqrs-register-plugin-spec.md
    __tests__/
      parseStore.spec.ts
      generateModule.spec.ts
      plugin.spec.ts
```


## 13. Риски и допущения

1. **Формат store файла** — предполагаем стандартную структуру с `defineStore` и `queryable`/`commandable` в return statement.

2. **DEPS convention** — Store ID определяется через `depIdsFiles`. Если id встречается в нескольких файлах — берем из **последнего** файла массива.

3. **Именованные импорты** — Query/Command классы импортируются через named imports (не default).

4. **Один store = один файл** — не поддерживаем несколько stores в одном файле.

5. **IoC integration** — stores загружаются через `getServiceAsync(storeId, container)`.


## 14. Миграция

После внедрения плагина:

1. Удалить `src/infrastructure/stores/register.ts`
2. Удалить `loader.ts` файлы из директорий stores (опционально)
3. Обновить `QueryInvoker` и `CommandInvoker` для использования registries
4. Удалить `CommandsQueries` из `src/domain/commandsQueries.ts` (заменяется на два registry)
5. Добавить type declaration в `vite-env.d.ts`

