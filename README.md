# Vue Dictionary - DDD Web Application

Современное веб-приложение на Vue.js 3 с TypeScript, построенное с использованием принципов Domain-Driven Design (DDD), Dependency Injection (DI) и элементов Command Query Responsibility Segregation (CQRS).

## 🏗️ Архитектура

Проект организован по принципам Clean Architecture и DDD:

### Слои приложения

```
src/
├── domain/           # Доменный слой
│   ├── commands/     # Команды (CQRS)
│   ├── queries/      # Запросы (CQRS)
│   ├── models/       # Доменные модели
│   └── interfaces/   # Интерфейсы домена
├── application/      # Слой приложения
│   └── services/     # Сервисы приложения
├── infrastructure/   # Инфраструктурный слой
│   ├── ioc/          # IoC контейнер (Inversify)
│   ├── stores/       # Хранилища данных
│   └── services/     # Инфраструктурные сервисы
└── ui/              # Слой пользовательского интерфейса
    ├── components/   # Vue компоненты
    ├── views/        # Представления
    └── handlers/     # Обработчики UI
```

### Ключевые паттерны

- **DDD (Domain-Driven Design)**: Доменная логика изолирована в `domain/` слое
- **DI (Dependency Injection)**: Использует Inversify.js для управления зависимостями
- **CQRS**: Разделение команд и запросов для лучшей организации кода
- **Clean Architecture**: Четкое разделение слоев с зависимостями, направленными внутрь

## 🚀 Технологии

- **Vue.js 3** - Прогрессивный JavaScript фреймворк
- **TypeScript** - Типизированный JavaScript
- **Inversify.js** - IoC контейнер для управления зависимостями
- **Vite** - Быстрый сборщик проекта
- **Vue Router** - Роутинг для SPA
- **Vitest** - Тестирование модулей
- **Playwright** - E2E тестирование

## 📦 Установка и запуск

### Требования

- Node.js 18+
- pnpm (рекомендуется)

### Установка зависимостей

```bash
pnpm install
```

### Разработка

```bash
# Запуск dev сервера
pnpm dev

# Сборка для production
pnpm build

# Preview production сборки
pnpm preview
```

### Тестирование

```bash
# Запуск unit тестов
pnpm test

# Запуск E2E тестов
pnpm test:e2e
```

## 🏛️ Принципы архитектуры

### Domain Layer (Доменный слой)

Содержит бизнес-логику и доменные модели:

- **Commands** - Операции изменения состояния
- **Queries** - Операции чтения данных
- **Models** - Доменные сущности (`User`, `Movie`)
- **Interfaces** - Контракты для внешних зависимостей

### Application Layer (Слой приложения)

Координирует выполнение бизнес-процессов:

- **Services** - Сервисы приложения
- **Handlers** - Обработчики команд и запросов

### Infrastructure Layer (Инфраструктурный слой)

Реализует технические детали:

- **IoC Container** - Конфигурация Inversify
- **Stores** - Управление состоянием (Counter, Date, Movies)
- **Services** - Внешние сервисы (PubSub, HTTP)

### UI Layer (Слой пользовательского интерфейса)

Vue.js компоненты и представления:

- **Components** - Переиспользуемые компоненты
- **Views** - Страницы приложения
- **Handlers** - Обработчики UI событий

## 🔧 Dependency Injection

Проект использует Inversify.js для управления зависимостями:

```typescript
// Регистрация зависимостей
container.bind<ILogger>(TYPES.Logger).to(ConsoleLogger)
container.bind<IUserService>(TYPES.UserService).to(UserService)

// Внедрение зависимостей
@injectable()
export class UserService {
  constructor(@inject(TYPES.Logger) private logger: ILogger) {}
}
```

## 📋 CQRS Pattern

Команды и запросы разделены для лучшей организации:

```typescript
// Команда (изменение состояния)
export class IncrementCommand extends CommandBase {
  async execute(step: number): Promise<void> {
    // Логика изменения состояния
  }
}

// Запрос (чтение данных)
export class MovieQuery extends QueryBase {
  async execute(): Promise<Movie[]> {
    // Логика получения данных
  }
}
```

## 🧪 Тестирование

Проект включает:

- **Unit тесты** - Тестирование доменной логики
- **E2E тесты** - Тестирование пользовательских сценариев
- **Mocking** - Изоляция компонентов при тестировании

## 📝 Разработка

### Добавление новой функциональности

1. **Создайте доменную модель** в `src/domain/models/`
2. **Добавьте команды/запросы** в `src/domain/commands/` или `src/domain/queries/`
3. **Реализуйте инфраструктуру** в `src/infrastructure/`
4. **Зарегистрируйте зависимости** в IoC контейнере
5. **Создайте UI компоненты** в `src/ui/`

### Соглашения по коду

- Используйте TypeScript для всех файлов
- Следуйте принципам SOLID
- Изолируйте доменную логику от внешних зависимостей
- Покрывайте код тестами

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функциональности
3. Внесите изменения с соблюдением архитектурных принципов
4. Добавьте тесты
5. Создайте Pull Request

## 📄 Лицензия

MIT License

---

_Проект демонстрирует применение современных архитектурных паттернов в веб-разработке с использованием Vue.js и TypeScript._
