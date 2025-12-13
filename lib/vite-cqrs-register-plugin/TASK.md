# Задание: Реализовать Vite-плагин vite-cqrs-register-plugin

## Цель

Создать Vite-плагин, который автоматически собирает маппинг Query/Command → Store ID из store-файлов и генерирует два виртуальных модуля.

## Что делает плагин

1. Сканирует `src/infrastructure/stores/**/**.ts`
2. Парсит AST каждого store-файла
3. Находит:
   - `defineStore(storeID, ...)` → извлекает Store ID
   - `queryable(QueryClass, ...)` → добавляет в queries registry
   - `commandable(CommandClass, ...)` → добавляет в commands registry
4. Генерирует два виртуальных модуля

## Выходные модули

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

export const commandsRegistry = new Map<Function, string>([
  [IncrementCommand, 'CounterStore'],
])
```

## Пример store-файла (входные данные)

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

## Структура файлов плагина

```
lib/vite-cqrs-register-plugin/
  index.ts           # главный файл, экспортирует плагин
  parseStore.ts      # парсинг store файла (AST)
  generateModule.ts  # генерация кода виртуальных модулей
  types.ts           # типы
```

## Ключевые моменты реализации

1. **Парсинг AST**: использовать `this.parse()` из Rollup + `estree-walker`
2. **Сканирование файлов**: использовать `fast-glob`
3. **HMR**: в dev режиме следить за изменениями и инвалидировать модули
4. **Работает в dev и prod**

## Опции плагина

```ts
interface CqrsRegisterPluginOptions {
  storesDir?: string           // default: 'src/infrastructure/stores'
  depIdsFiles: string[]      // default: ['@/infrastructure/depIds']
  queriesVirtualModuleId?: string   // default: 'virtual:queries-registry'
  commandsVirtualModuleId?: string  // default: 'virtual:commands-registry'
  devTelemetry?: boolean       // default: false
}
```

## Полная спецификация

См. файл `vite-cqrs-register-plugin-spec.md` в этой же директории.

## Примеры для изучения

- `lib/vite-inject-vue-deps-plugin/vite-inject-vue-deps-plugin.ts` — похожий плагин с AST парсингом
- `lib/vite-chunks-map-plugin/` — ещё один пример Vite плагина в проекте

