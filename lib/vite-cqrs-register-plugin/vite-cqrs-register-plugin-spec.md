
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
   - Store ID из `defineStore(INFRA_DEPS.StoreName, ...)` или `defineStore('storeName', ...)`

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
  exclude?: string[]  // default: ['**/__tests__/**', '**/loader.ts', '**/types.ts', '**/config.ts', '**/register.ts']

  /** Массив путей к TS-файлам с export const DEPS = { ... } */
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


## 2. Структура depIds файлов (откуда берём Store ID)

### 2.1. Общая идея

Плагин **один раз** при старте читает все указанные `depIdsFiles` и строит единую карту `key → value`. Эта карта используется для резолва Store ID во всех store-файлах.

### 2.2. Формат depIds файлов

Плагин парсит TypeScript файлы с объявлениями констант. Извлекаются только **явные свойства со строковыми значениями**:

```ts
// src/infrastructure/depIds.ts
import { APP_DEPS } from '@/application/depIds'

export const INFRA_DEPS = {
  ...APP_DEPS,                    // ← игнорируется (spread)
  MoviesStore: 'MoviesStore',     // ← извлекается
  CounterStore: 'CounterStore',   // ← извлекается
  DateStore: 'DateStore',         // ← извлекается
} as const
```

### 2.3. Что извлекаем из depIds

Для каждого depIds файла строим карту `ConstName.PropertyName → string value`:

```ts
// Из INFRA_DEPS = { MoviesStore: 'MoviesStore', CounterStore: 'CounterStore' }
// Получаем:
depIdsMap['INFRA_DEPS.MoviesStore'] = 'MoviesStore'
depIdsMap['INFRA_DEPS.CounterStore'] = 'CounterStore'
depIdsMap['INFRA_DEPS.DateStore'] = 'DateStore'
```

### 2.4. Обработка spread operator

Если встречается `...APP_DEPS`, плагин **НЕ резолвит** импорты рекурсивно. Spread просто игнорируется.

Это означает, что нужно указывать в `depIdsFiles` только те файлы, где Store ID определены **явно** (не через spread).

### 2.5. Практическая рекомендация

В проекте stores используют `INFRA_DEPS.CounterStore`, и Store ID определены явно в `src/infrastructure/depIds.ts`. 

Поэтому **достаточно указать один файл**:

```ts
depIdsFiles: ['src/infrastructure/depIds.ts']
```

Если в будущем Store ID будут определяться в других файлах — добавить их в массив.

### 2.6. Порядок обработки (если несколько файлов)

Файлы обрабатываются в порядке массива. Если один и тот же ключ встречается в нескольких файлах — используется значение из **последнего** файла.


## 3. Структура store-файла (что анализируем)

### 3.1. Типичный store

```ts
// src/infrastructure/stores/counter/counter.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { queryable } from '@/infrastructure/queries/queryable'
import { commandable } from '@/infrastructure/queries/commandable'
import { CurrentUserQuery } from '@/domain/queries/user.query'
import { IncrementCommand } from '@/domain/commands/increment.command'
import { INFRA_DEPS } from '@/infrastructure/depIds'

const useCounterStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  async function increment1(_query: CurrentUserQuery): Promise<User> {
    count.value++
    return new User()
  }

  async function increment(cmd: IncrementCommand): Promise<void> {
    count.value += cmd.step
    return Promise.resolve()
  }

  return {
    count,
    doubleCount,
    increment: commandable(IncrementCommand, action(increment)),
    increment1: queryable(CurrentUserQuery, action(increment1))
  }
})

export default useCounterStore
```

### 3.2. Что извлекаем из store файла

1. **Store ID expression** — первый аргумент `defineStore()`:
   - `MemberExpression`: `INFRA_DEPS.CounterStore` → строка `"INFRA_DEPS.CounterStore"`
   - `Literal`: `'counter'` → строка `"'counter'"`

2. **Query классы** — первый аргумент каждого `queryable()` вызова

3. **Command классы** — первый аргумент каждого `commandable()` вызова

4. **Import paths** — откуда импортированы Query/Command классы

### 3.3. Множественные queryable/commandable в одном store

Один store может содержать **несколько** `queryable()` и `commandable()` вызовов:

```ts
return {
  getUser: queryable(CurrentUserQuery, action(getUser)),
  getMovies: queryable(MovieListQuery, action(getMovies)),  // ещё один query
  increment: commandable(IncrementCommand, action(increment)),
  reset: commandable(ResetCommand, action(reset)),  // ещё один command
}
```

Все они должны быть собраны и добавлены в соответствующие registry.


## 4. Алгоритм работы плагина

### 4.1. Этап configResolved

1. Читаем и парсим все `depIdsFiles`
2. Строим общую карту `depIdsMap: Map<string, string>`
   - ключ: `"INFRA_DEPS.CounterStore"`
   - значение: `"CounterStore"`

### 4.2. Этап buildStart

1. Сканируем `storesDir` по паттерну `storePattern`
2. Исключаем файлы по `exclude`
3. Для каждого найденного файла:
   - парсим AST
   - извлекаем Store ID expression, Queries, Commands
   - резолвим Store ID expression в реальное значение через `depIdsMap`

### 4.3. Парсинг depIds файла

```ts
interface DepIdEntry {
  constName: string      // 'INFRA_DEPS'
  propertyName: string   // 'CounterStore'
  value: string          // 'CounterStore'
}

function parseDepIdsFile(code: string): DepIdEntry[] {
  const ast = parse(code)
  const entries: DepIdEntry[] = []
  
  walk(ast, {
    enter(node) {
      // Ищем: export const CONST_NAME = { ... }
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && decl.init?.type === 'ObjectExpression') {
            const constName = decl.id.name
            
            for (const prop of decl.init.properties) {
              // Пропускаем SpreadElement (...APP_DEPS)
              if (prop.type === 'SpreadElement') continue
              
              if (prop.type === 'Property' && 
                  prop.key.type === 'Identifier' &&
                  prop.value.type === 'Literal' &&
                  typeof prop.value.value === 'string') {
                entries.push({
                  constName,
                  propertyName: prop.key.name,
                  value: prop.value.value
                })
              }
            }
          }
        }
      }
    }
  })
  
  return entries
}
```

### 4.4. Парсинг store файла

```ts
interface StoreParseResult {
  storeIdExpr: string           // 'INFRA_DEPS.CounterStore' или "'counter'"
  queries: CqrsEntry[]
  commands: CqrsEntry[]
}

interface CqrsEntry {
  className: string             // 'CurrentUserQuery'
  importPath: string            // '@/domain/queries/user.query'
}

function parseStoreFile(code: string): StoreParseResult {
  const ast = parse(code)
  
  // 1. Собираем импорты
  const importMap: Map<string, { originalName: string; importPath: string }> = new Map()
  
  // 2. Ищем defineStore
  let storeIdExpr: string | null = null
  
  // 3. Ищем queryable/commandable
  const queries: CqrsEntry[] = []
  const commands: CqrsEntry[] = []
  
  walk(ast, {
    enter(node) {
      // Импорты
      if (node.type === 'ImportDeclaration') {
        const importPath = node.source.value
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const localName = spec.local.name
            const originalName = spec.imported.name
            importMap.set(localName, { originalName, importPath })
          }
        }
      }
      
      // defineStore
      if (node.type === 'CallExpression' && 
          node.callee.type === 'Identifier' && 
          node.callee.name === 'defineStore') {
        const firstArg = node.arguments[0]
        if (firstArg.type === 'MemberExpression') {
          // INFRA_DEPS.CounterStore
          const obj = firstArg.object.name    // 'INFRA_DEPS'
          const prop = firstArg.property.name // 'CounterStore'
          storeIdExpr = `${obj}.${prop}`
        } else if (firstArg.type === 'Literal') {
          // 'counter'
          storeIdExpr = `'${firstArg.value}'`
        }
      }
      
      // queryable / commandable
      if (node.type === 'CallExpression' && 
          node.callee.type === 'Identifier') {
        const fnName = node.callee.name
        if (fnName === 'queryable' || fnName === 'commandable') {
          const firstArg = node.arguments[0]
          if (firstArg.type === 'Identifier') {
            const className = firstArg.name
            const importInfo = importMap.get(className)
            if (importInfo) {
              const entry: CqrsEntry = {
                className: importInfo.originalName,
                importPath: importInfo.importPath
              }
              if (fnName === 'queryable') {
                queries.push(entry)
              } else {
                commands.push(entry)
              }
            }
          }
        }
      }
    }
  })
  
  return { storeIdExpr, queries, commands }
}
```

### 4.5. Резолв Store ID

После парсинга store файла получаем `storeIdExpr` (например, `"INFRA_DEPS.CounterStore"`).

Резолвим его в реальное значение:

```ts
function resolveStoreId(storeIdExpr: string, depIdsMap: Map<string, string>): string {
  // Если это строковый литерал: "'counter'" → 'counter'
  if (storeIdExpr.startsWith("'") && storeIdExpr.endsWith("'")) {
    return storeIdExpr.slice(1, -1)
  }
  
  // Если это MemberExpression: "INFRA_DEPS.CounterStore"
  const resolved = depIdsMap.get(storeIdExpr)
  if (resolved) {
    return resolved
  }
  
  throw new Error(`Cannot resolve Store ID: ${storeIdExpr}. ` +
    `Make sure it's defined in one of depIdsFiles.`)
}
```

### 4.6. Результат сканирования

```ts
interface StoreInfo {
  filePath: string              // 'src/infrastructure/stores/counter/counter.ts'
  storeId: string               // 'CounterStore' (resolved)
  queries: CqrsEntry[]
  commands: CqrsEntry[]
}

const stores: StoreInfo[] = []
```


## 5. Генерация виртуальных модулей

### 5.1. IDs

```ts
const QUERIES_VIRTUAL_ID = options.queriesVirtualModuleId ?? 'virtual:queries-registry'
const COMMANDS_VIRTUAL_ID = options.commandsVirtualModuleId ?? 'virtual:commands-registry'
const RESOLVED_QUERIES_ID = '\0' + QUERIES_VIRTUAL_ID
const RESOLVED_COMMANDS_ID = '\0' + COMMANDS_VIRTUAL_ID
```

### 5.2. Hooks

- `resolveId(id)`:
  - если `id === QUERIES_VIRTUAL_ID` → return `RESOLVED_QUERIES_ID`
  - если `id === COMMANDS_VIRTUAL_ID` → return `RESOLVED_COMMANDS_ID`

- `load(id)`:
  - если `id === RESOLVED_QUERIES_ID` → генерируем модуль queries
  - если `id === RESOLVED_COMMANDS_ID` → генерируем модуль commands

### 5.3. Генерация кода для queries

```ts
function generateQueriesModule(stores: StoreInfo[]): string {
  const imports: string[] = []
  const entries: string[] = []
  const seen = new Set<string>()  // Избегаем дубликатов импортов
  
  for (const store of stores) {
    for (const query of store.queries) {
      const importKey = `${query.className}:${query.importPath}`
      if (!seen.has(importKey)) {
        seen.add(importKey)
        imports.push(`import { ${query.className} } from '${query.importPath}'`)
      }
      entries.push(`  [${query.className}, '${store.storeId}']`)
    }
  }
  
  if (imports.length === 0) {
    return `export const queriesRegistry = new Map<Function, string>()\n`
  }
  
  return `${imports.join('\n')}

export const queriesRegistry = new Map<Function, string>([
${entries.join(',\n')}
])
`
}
```

### 5.4. Генерация кода для commands

```ts
function generateCommandsModule(stores: StoreInfo[]): string {
  const imports: string[] = []
  const entries: string[] = []
  const seen = new Set<string>()
  
  for (const store of stores) {
    for (const command of store.commands) {
      const importKey = `${command.className}:${command.importPath}`
      if (!seen.has(importKey)) {
        seen.add(importKey)
        imports.push(`import { ${command.className} } from '${command.importPath}'`)
      }
      entries.push(`  [${command.className}, '${store.storeId}']`)
    }
  }
  
  if (imports.length === 0) {
    return `export const commandsRegistry = new Map<Function, string>()\n`
  }
  
  return `${imports.join('\n')}

export const commandsRegistry = new Map<Function, string>([
${entries.join(',\n')}
])
`
}
```


## 6. Использование в QueryInvoker / CommandInvoker

### 6.1. Изменение QueryInvoker

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

### 6.2. Изменение CommandInvoker

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


## 7. Hot Module Replacement (HMR)

### 7.1. Отслеживание изменений

В dev режиме плагин должен:

1. Следить за изменениями в `storesDir`
2. При изменении store файла:
   - перепарсить файл
   - обновить registry
   - инвалидировать виртуальный модуль

3. Следить за изменениями в `depIdsFiles`
4. При изменении depIds файла:
   - перепарсить все depIds файлы
   - пересканировать все stores (т.к. могли измениться resolved values)
   - инвалидировать оба виртуальных модуля

### 7.2. Реализация

```ts
configureServer(server) {
  // Следим за store файлами
  server.watcher.on('change', (file) => {
    if (isStoreFile(file)) {
      updateStoreRegistry(file)
      invalidateVirtualModules(server)
    }
    
    if (isDepIdsFile(file)) {
      rebuildDepIdsMap()
      rescanAllStores()
      invalidateVirtualModules(server)
    }
  })
  
  server.watcher.on('add', (file) => {
    if (isStoreFile(file)) {
      addStoreToRegistry(file)
      invalidateVirtualModules(server)
    }
  })
  
  server.watcher.on('unlink', (file) => {
    if (isStoreFile(file)) {
      removeStoreFromRegistry(file)
      invalidateVirtualModules(server)
    }
  })
}

function invalidateVirtualModules(server: ViteDevServer) {
  const queriesMod = server.moduleGraph.getModuleById(RESOLVED_QUERIES_ID)
  const commandsMod = server.moduleGraph.getModuleById(RESOLVED_COMMANDS_ID)
  
  if (queriesMod) {
    server.moduleGraph.invalidateModule(queriesMod)
  }
  if (commandsMod) {
    server.moduleGraph.invalidateModule(commandsMod)
  }
}
```


## 8. Обработка ошибок

### 8.1. Store ID не найден в defineStore

Если `defineStore(...)` не найден в файле:
- **warning** в консоль (файл может быть utility, не store)
- пропускаем файл

### 8.2. Store ID не резолвится

Если `INFRA_DEPS.SomeStore` не найден в `depIdsMap`:
- **error** в консоль
- останавливаем сборку с понятным сообщением

### 8.3. Query/Command не импортирован

Если `queryable(SomeQuery, ...)` но `SomeQuery` не найден в импортах:
- **error** в консоль
- останавливаем сборку


## 9. Использование плагина

### 9.1. Конфигурация Vite

```ts
// vite.config.ts
import { cqrsRegisterPlugin } from './lib/vite-cqrs-register-plugin'

export default defineConfig({
  plugins: [
    cqrsRegisterPlugin({
      storesDir: 'src/infrastructure/stores',
      depIdsFiles: ['src/infrastructure/depIds.ts'],  // файл с Store ID
      devTelemetry: true
    })
  ]
})
```

### 9.2. TypeScript декларации

```ts
// src/vite-env.d.ts
declare module 'virtual:queries-registry' {
  export const queriesRegistry: Map<Function, string>
}

declare module 'virtual:commands-registry' {
  export const commandsRegistry: Map<Function, string>
}
```


## 10. Поведение в разных режимах

| Режим | Поведение |
|-------|-----------|
| `vite dev` | Сканирует при старте + HMR при изменениях |
| `vite build` | Сканирует один раз, генерирует код в бандл |
| `vite preview` | Использует сгенерированный код из build |


## 11. Логирование и отладка

Если `devTelemetry: true`:

```
[vite-cqrs-register] Parsing depIds files...
[vite-cqrs-register]   src/infrastructure/depIds.ts: 3 entries
[vite-cqrs-register] Total depIds entries: 3

[vite-cqrs-register] Scanning stores in: src/infrastructure/stores
[vite-cqrs-register] Found 3 store files

[vite-cqrs-register] counter/counter.ts:
  Store ID: INFRA_DEPS.CounterStore → 'CounterStore'
  Queries:
    - CurrentUserQuery (@/domain/queries/user.query)
  Commands:
    - IncrementCommand (@/domain/commands/increment.command)

[vite-cqrs-register] movies/movies.ts:
  Store ID: INFRA_DEPS.MoviesStore → 'MoviesStore'
  Queries:
    - MovieListQuery (@/domain/queries/movie.query)

[vite-cqrs-register] date/date.ts:
  Store ID: INFRA_DEPS.DateStore → 'DateStore'
  Commands:
    - DateUpdateCommand (@/domain/commands/date.command)

[vite-cqrs-register] Total: 2 queries, 2 commands
```


## 12. Acceptance criteria / тесты

### 12.1. Unit-тесты (vitest)

1. **Парсинг depIds файлов**
   - `INFRA_DEPS = { CounterStore: 'CounterStore' }` → `depIdsMap['INFRA_DEPS.CounterStore'] = 'CounterStore'`
   - Spread operator `...APP_DEPS` игнорируется
   - Несколько констант в одном файле обрабатываются

2. **Парсинг импортов в store**
   - `import { X } from 'path'` → `importMap['X'] = { originalName: 'X', importPath: 'path' }`
   - `import { X as Y } from 'path'` → `importMap['Y'] = { originalName: 'X', importPath: 'path' }`

3. **Парсинг Store ID**
   - `defineStore(INFRA_DEPS.CounterStore, ...)` → storeIdExpr = `'INFRA_DEPS.CounterStore'`
   - `defineStore('counter', ...)` → storeIdExpr = `"'counter'"`

4. **Резолв Store ID**
   - `'INFRA_DEPS.CounterStore'` + depIdsMap → `'CounterStore'`
   - `"'counter'"` → `'counter'`

5. **Парсинг queryable/commandable**
   - `queryable(CurrentUserQuery, action(fn))` → добавляется в queries
   - `commandable(IncrementCommand, action(fn))` → добавляется в commands
   - Несколько вызовов в одном store — все находятся

6. **Генерация виртуальных модулей**
   - `virtual:queries-registry` экспортирует только `queriesRegistry`
   - `virtual:commands-registry` экспортирует только `commandsRegistry`
   - Каждый модуль содержит только нужные импорты
   - Store ID в Map — строка (не MemberExpression)
   - Синтаксически валидный TypeScript

7. **Раздельность модулей**
   - Query попадает только в `virtual:queries-registry`
   - Command попадает только в `virtual:commands-registry`

### 12.2. Интеграционный тест

1. Создать тестовый проект с 3 stores
2. Запустить vite build
3. Проверить что `virtual:queries-registry` экспортирует `queriesRegistry`
4. Проверить что `virtual:commands-registry` экспортирует `commandsRegistry`
5. Проверить что `queriesRegistry.get(MovieListQuery) === 'MoviesStore'`
6. Проверить что `commandsRegistry.get(IncrementCommand) === 'CounterStore'`


## 13. Структура файлов

```
lib/
  vite-cqrs-register-plugin/
    index.ts                  # главный файл плагина
    parseDepIds.ts            # парсинг depIds файлов
    parseStore.ts             # парсинг store файла
    generateModule.ts         # генерация виртуального модуля
    types.ts                  # типы
    vite-cqrs-register-plugin-spec.md
    TASK.md
    __tests__/
      parseDepIds.spec.ts
      parseStore.spec.ts
      generateModule.spec.ts
      plugin.spec.ts
```


## 14. Риски и допущения

1. **Формат store файла** — предполагаем стандартную структуру с `defineStore` и `queryable`/`commandable` в return statement.

2. **Формат depIds файла** — предполагаем `export const CONST_NAME = { key: 'value' } as const`.

3. **Строковые значения Store ID** — в depIds файлах значения Store ID должны быть строками (`'MoviesStore'`), не Symbol.

4. **DEPS convention** — Store ID определяется через `depIdsFiles`. Если id встречается в нескольких файлах — берём из **последнего** файла массива.

5. **Именованные импорты** — Query/Command классы импортируются через named imports (не default).

6. **Один store = один файл** — не поддерживаем несколько stores в одном файле.

7. **IoC integration** — stores загружаются через `getServiceAsync(storeId, container)`.


## 15. Миграция

После внедрения плагина:

1. Удалить `src/infrastructure/stores/register.ts`
2. Удалить `loader.ts` файлы из директорий stores (опционально)
3. Обновить `QueryInvoker` и `CommandInvoker` для использования registries
4. Удалить `CommandsQueries` из `src/domain/commandsQueries.ts` (заменяется на два registry)
5. Добавить type declaration в `vite-env.d.ts`
