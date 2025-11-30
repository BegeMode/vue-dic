
# Спецификация: Vite-плагин для сбора карты зависимостей по роутам (Vue 3, Vite 7, prod-only)

## 0. Цель и результат

Нужно реализовать Vite-плагин `vite-chunks-map-plugin` для production-сборки, который:

1. Во время `vite build` (только prod) строит карту зависимостей:

```ts
type RouteDepsMap = Record<string /* routePath */, string[] /* chunk file names */>
```

2. Зависимости роута включают:
   - все **динамические импорты** (`import()`, `defineAsyncComponent(() => import())`, `import.meta.glob / globEager`) начиная от корневого компонента роута и далее по дереву потомков;
   - **IoC-зависимости** из `deps:` и `defineDeps(...)`, разрешённые через входные карты `DEPS.ID -> file` (только динамические импорты, статические зависимости игнорируются).

3. На выходе генерирует **один виртуальный модуль**:
   - доступный в рантайме как:
     ```ts
     import depsMap from 'virtual:route-deps-map'
     ```
   - который экспортирует готовую `RouteDepsMap`.

4. Генерирует **один asset-файл** с картой:
   - `assets/route-deps-map-[hash].js`

> Важно: карта может быть с запасом (лишние чанки допустимы).

### 0.1. Пример результата

Для проекта с роутами `/`, `/about`, `/movies`:

```ts
// virtual:route-deps-map
export default {
  "/": [
    "assets/HomeView-CgJr5c8B.js",
    "assets/firstService-BkHtHPE4.js"
  ],
  "/about": [
    "assets/AboutView-D1fRHH7P.js",
    "assets/AboutView-gN2ZyUXG.css"
  ],
  "/movies": [
    "assets/MovieList-n7oksCfB.js",
    "assets/MovieList-C_1MruA8.css",
    "assets/alertQuery.handler-CT293hRL.js"
  ]
}
```


## 1. Входные параметры плагина

```ts
export interface RouteDepsPluginOptions {
  /** Абсолютный или относительный путь к папке router с createRouter(...) */
  routerDir: string

  /** Массив путей к TS-файлам с export const deps = ... */
  iocMapFiles: string[]

  /** Имя виртуального модуля для рантайма */
  virtualModuleId?: string // default 'virtual:route-deps-map'

  /** Включать ли glob/globEager эвристику */
  enableGlobImports?: boolean // default true

  /** Логирование в консоль во время сборки */
  devTelemetry?: boolean // default false
}
```

### 1.1. Зависимости плагина

Используются встроенные возможности Vite/Rollup:
- `this.parse()` — парсинг AST
- `this.resolve()` — резолвинг путей
- `this.getModuleInfo()` — получение информации о модулях
- `this.emitFile()` — генерация файлов

Внешние зависимости:
- `estree-walker` — обход AST (уже используется в IoC-плагине)


## 2. Изменения существующего плагина IoC

Файл:  
`lib/vite-inject-vue-deps-plugin/vite-inject-vue-deps-plugin.ts`

### 2.1. Текущее поведение
- парсит AST SFC/TS,
- собирает зависимости (ID `DEPS.*`) для **текущего** файла,
- умеет модифицировать код, но **не экспортирует** собранные deps наружу.

### 2.2. Новое поведение (расширение)
Плагин должен уметь:
1. Собирать найденные `DEPS.*` для каждого модуля.
2. Публиковать их в общий виртуальный “шина-модуль”.

### 2.3. Интерфейс “шины”
Добавить в IoC-плагин:

- внутреннее хранилище:
  ```ts
  const fileIocDeps = new Map<string /* moduleId */, Set<string /* depSymbolString */>>()
  ```
  где `depSymbolString` — строковое представление ключа символа, например `'DEPS.DateTime'`.

- виртуальный модуль:
  ```ts
  const VIRTUAL_IOC_DEPS_ID = 'virtual:ioc-deps-graph'
  const RESOLVED_VIRTUAL_IOC_DEPS_ID = '\0' + VIRTUAL_IOC_DEPS_ID
  ```

- хуки:
  - `resolveId(id)` — если `id === VIRTUAL_IOC_DEPS_ID`, вернуть `RESOLVED_VIRTUAL_IOC_DEPS_ID`.
  - `load(id)` — если это resolved id, вернуть модуль:

    ```ts
    export const iocDepsByFile = /* JSON of map */
    ```

- наполнение карты:
  в `transform(code, id)` после успешного парса:
  - найти:
    - `defineComponent({ deps: { ... }})`
    - `defineDeps<T>({ ... })`
  - добавить в `fileIocDeps.get(id)` все встреченные идентификаторы `DEPS.X`.

### 2.4. Формат выгрузки
В `load` виртуального модуля:

```ts
export const iocDepsByFile: Record<string, string[]> = {
  "/abs/path/src/ui/views/HomeView.vue": ["DEPS.DateTime", "DEPS.First"],
  ...
}
```


## 3. Разбор входных карт IoC ID -> file

Каждый файл из `options.iocMapFiles` имеет вид (примеры: src/infrastructure/deps.ts, src/ui/deps.ts):

```ts
export const deps = {
  [DEPS.Logger]: Logger,  // статическая — ИГНОРИРУЕМ
  [DEPS.AlertQuery]: queryDynamicImport(DEPS.AlertQuery, AlertQuery, () => import('@/ui/...')),
  [DEPS.First]: { loader: () => import('@/ui/services/firstService'), scope: ... }
}
```

### 3.1. Требуемый результат парсинга

Построить карту **только динамических** зависимостей:

```ts
type DepIdToDynamicImport = Record<string /* 'DEPS.First' */, string /* resolved module path */>
```

Правила:
1. **Статические зависимости игнорируются** (`[DEPS.X]: SomeClass` — пропускаем).
2. Если id встречается в нескольких файлах — берем из **последнего** файла массива `iocMapFiles`.
3. Поддерживаем формы динамических зависимостей:
   - `[DEPS.X]: queryDynamicImport(..., () => import('path'))` → `path`
   - `[DEPS.X]: { loader: () => import('path') }` → `path`
   - `[DEPS.X]: () => import('path')` → `path`

### 3.2. Реализация парсинга
В RouteDeps-плагине делаем `this.parse` (Rollup) по TS:

- ищем `ExportNamedDeclaration` с `VariableDeclarator` `deps`.
- затем `ObjectExpression.properties`:
  - ключ — `ComputedPropertyName` с `MemberExpression` `DEPS.X`
  - значение — ищем любой `import('...')` внутри
- из `import('...')` берем строковый литерал.

> Alias `@` резолвим через vite config (`resolve.alias`) → абсолютный путь.


## 4. Сбор графа динамических импортов (JS/Vue уровни)

RouteDeps-плагин должен собрать для каждого модуля список его **динамических импортов**:

```ts
const dynamicImportsByFile = new Map<string, Set<string /* resolved module id */>>()
```

### 4.1. Что считается динамическим импортом
Поддержать:

1. чистый `import('...')`
2. `defineAsyncComponent(() => import('...'))`
3. `import.meta.glob('...')`
4. `import.meta.globEager('...')` (считаем как **набор** динамических импортов)

Если внутри import аргумент не строковый литерал → игнор, но:
- допускаем “с запасом”: если `enableGlobImports = true`, то для glob:
  - вычисляем список файлов через `fast-glob` по шаблону
  - добавляем все совпадения

### 4.2. На каких файлах работает сбор
- все `.vue`, `.ts`, `.tsx`, `.js`, `.jsx` проходящие через Rollup graph.
- SFC: анализируем `<script setup>` и `<script>` (Vite уже даёт JS код на transform).

### 4.3. Хук и логика
В `transform(code, id)`:
- применять **только при `apply: 'build'`** у плагина.
- парсим AST:
  - сохраняем найденные `import(...)` targets в `dynamicImportsByFile.get(id)`.
  - targets резолвим через `this.resolve(target, id)`.


## 5. Сбор роутов и их корневых компонентов

### 5.1. Где ищем роуты
- сканируем все TS/JS в `routerDir`.
- находим `createRouter({ routes: [...] })` или экспорт массива routes.

### 5.2. Правила извлечения маршрутов
Маршрут идентифицируется **path**.

Для каждого route:
1. если есть `component` → это корневой компонент.
2. если нет `component`, но есть `redirect`/`alias` → рекурсивно анализируем `children` и берем их.
3. nested routes:
   - корневой компонент берём у каждого узла отдельно (если есть).
   - итоговая карта строится для **каждого path** из дерева.

### 5.3. Поддерживаемые формы component (src/ui/router)
- `component: HomeView` (статический импорт)
- `component: loadView(() => import('...'))`
- `component: () => import('...')`
- `component: loadView(() => new Promise(resolve => resolve(import('...'))))`
  
Нужно:
- найти внутри значения `component` **любой** `import('...')` → считать его корневым динамическим импортом.
- если import не найден и значение является идентификатором (`HomeView`) → резолвим через статические импорты файла роутера.


## 6. Построение зависимостей роутов

Для каждого route path:

### 6.1. Стартовый набор модулей
`entryModules(route)`:

- если корневой компонент найден как `import('x')` → `x` (resolved id)
- если компонент статический `HomeView`:
  - ищем реальный модуль по графу Rollup:
    - во время `buildStart` сохраняем `staticImportsByFile` аналогично dynamic, или
    - проще: на этапе `generateBundle`, используем `getModuleInfo` для файла роутера и идём по `importedIds`, пока не найдём модуль `HomeView` (эвристика).  
  - если не нашли — добавляем файл роутера как точку входа (с запасом).

### 6.2. Обход графа
Делаем BFS/DFS по модульному графу:

```
visited = Set<moduleId>
queue = entryModules
routeDynamicTargets = Set<moduleId>

while queue not empty:
  m = queue.pop()
  if visited has m continue
  visited add m

  // динамические импорты
  for each d in dynamicImportsByFile[m]:
      routeDynamicTargets add d
      queue.push(d)

  // статические импорты (для того чтобы дойти до потомков)
  info = this.getModuleInfo(m)
  for each s in info.importedIds:
      queue.push(s)

  // ioc deps (только динамические!)
  for each depId in iocDepsByFile[m]:
      if depId in DepIdToDynamicImport:
          routeDynamicTargets add DepIdToDynamicImport[depId]
          queue.push(DepIdToDynamicImport[depId])
```

> Так мы доходим по статике до всех потомков компонента и собираем все динамические импорты и динамические IoC-зависимости.


## 7. Привязка модулей к чанкам (generateBundle)

На этапе `generateBundle(outputOptions, bundle)`:

1. Создаём индекс:
   ```ts
   const chunkByModule = new Map<string /* moduleId */, string /* chunkFileName */>()
   const cssByChunk = new Map<string /* chunkFileName */, Set<string> /* css file names */>()
   ```

2. Для каждого `OutputChunk` из bundle:
   - берем `chunk.modules` (ключи — moduleId),
   - кладём для каждого модуля `chunk.fileName`.
   - собираем CSS:
     ```ts
     // Vite 5-7: viteMetadata.importedCss
     const importedCss = (chunk as any).viteMetadata?.importedCss as Set<string> | undefined
     if (importedCss) {
       cssByChunk.set(chunk.fileName, importedCss)
     }
     ```

3. Для каждого route:
   - берем все moduleId из `routeDynamicTargets`,
   - маппим через `chunkByModule` → получаем JS чанки,
   - для каждого JS чанка добавляем связанные CSS из `cssByChunk`.

Итог:
```ts
RouteDepsMap[routePath] = [...jsChunks, ...cssFiles].sort()
```


## 8. Генерация виртуального модуля `virtual:route-deps-map`

### 8.1. IDs
```ts
const VIRTUAL_ID = options.virtualModuleId ?? 'virtual:route-deps-map'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID
```

### 8.2. Hooks
- `resolveId(id)`:
  - если `id === VIRTUAL_ID` → return RESOLVED_VIRTUAL_ID

- `load(id)`:
  - если `id === RESOLVED_VIRTUAL_ID`:
    - вернуть placeholder:
      ```ts
      export default "__ROUTE_DEPS_MAP_PLACEHOLDER__"
      ```

### 8.3. Эмит реального файла
В `generateBundle` после построения карты заменяем placeholder на реальные данные:

```ts
// Находим чанк с виртуальным модулем
for (const [fileName, chunk] of Object.entries(bundle)) {
  if (chunk.type === 'chunk' && chunk.code.includes('__ROUTE_DEPS_MAP_PLACEHOLDER__')) {
    chunk.code = chunk.code.replace(
      '"__ROUTE_DEPS_MAP_PLACEHOLDER__"',
      JSON.stringify(routeDepsMap)
    )
  }
}
```

Альтернативно, если виртуальный модуль не включён в граф сборки напрямую:

```ts
this.emitFile({
  type: 'asset',
  fileName: 'assets/route-deps-map.js',
  source: `export default ${JSON.stringify(routeDepsMap, null, 2)}`
})
```


## 9. Поведение в dev и режимы

Плагин:
```ts
{
  name: 'vite-route-deps-map-plugin',
  apply: 'build',
  enforce: 'post'
}
```

- в dev не запускается вообще.
- в build работает на трансформациях и generateBundle.


## 10. Логирование и отладка

Если `devTelemetry: true`:
- логируем:
  - найденные routes и entry modules
  - количество модулей в обходе
  - итоговые чанки на route


## 11. Acceptance criteria / тесты

### 11.1. Unit-тесты (vitest)

1. **Парсинг роутов**
   - из примера router:
     - paths: `/`, `/about`, `/movies`
     - у `/movies` import внутри Promise, должен быть найден `@/ui/views/MovieList.vue`.

2. **Сбор dynamic imports**
   - компонент с `defineAsyncComponent(() => import('X'))` → X попадает.

3. **Сбор IoC deps**
   - компонент из примера `defineDeps({ dateTimeService: DEPS.DateTime, firstService: DEPS.First })`
   - must add:
     - файл firstService (динамический import из карты `{ loader: () => import(...) }`)
   - НЕ добавляем статические зависимости (dateTimeService).

4. **Конфликт ID**
   - два файла карт: первый даёт `DEPS.First -> A`, второй -> `B`.  
     В итог попадает `B`.

### 11.2. Интеграционный тест (фикстура Vite проекта)

Собрать мини-проект с вашим router+components:
- проверить, что в `dist/assets` есть файлы из карты.
- импорт `virtual:route-deps-map` в рантайме возвращает объект:
  - ключи — route paths
  - значения — массив `.js` и `.css` файлов, реально существующих в dist.


## 12. Структура файлов

```
lib/
  vite-chunks-map-plugin/
    index.ts              # главный файл плагина
    parseRouter.ts        # парсинг роутов
    parseDynamicImports.ts # сбор динамических импортов
    parseIocMaps.ts       # парсинг карт IoC
    graphWalk.ts          # обход графа зависимостей
    types.ts              # типы
    __tests__/
      vite-chunks-map-plugin.spec.ts
```


## 13. Риски и допущения

1. import с переменной без glob — игнорируем (допускается с запасом).
2. Статические компоненты резолвим через статические импорты файла роутера.
3. CSS привязка по `viteMetadata.importedCss` — стабильный API Vite 5-7.
