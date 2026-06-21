# Task Endpoints

Esta documentacao define como o frontend deve buscar tasks no Praxis.

Regra principal:

```text
A UI nao deve carregar todas as tasks para depois filtrar em tela.
Cada tela deve consumir o endpoint especifico do seu recorte.
```

## Service

Use os wrappers em:

```text
src/shared/lib/tasks/task.service.ts
```

Evite chamar `invoke(...)` diretamente dentro de paginas/componentes.

## Resultado Padrao

Os endpoints especificos retornam `TaskListResult`:

```ts
type TaskListResult = {
  tasks: Task[];
  checklistItems: ChecklistItem[];
  reminders: PersistedReminder[];
  badge: BadgeSnapshot;
};
```

`tasks` vem ordenado pelo Rust na ordem oficial do produto.

`checklistItems` e `reminders` retornam apenas dados relacionados as tasks daquele recorte.

`badge` retorna o estado atual do contador do app.

## Paginacao

Todos os endpoints especificos aceitam:

```ts
type TaskListOptions = {
  limit?: number;
  offset?: number;
};
```

Exemplo:

```ts
await listTodayTasks({ limit: 50, offset: 0 });
```

Para telas reais, prefira sempre informar `limit`.

## Endpoints Por Tela

### getTaskViewCounts()

Uso:

```ts
const counts = await getTaskViewCounts();
```

Quando usar:

- sidebar
- badges de navegacao
- contadores pequenos de dashboard

Retorna apenas numeros, sem carregar listas:

```ts
type TaskViewCounts = {
  today: number;
  week: number;
  pending: number;
  overdue: number;
  upcoming: number;
  reminders: number;
  completed: number;
  badge: BadgeSnapshot;
};
```

Regra dos contadores:

- `today`: pendentes do Meu Dia, mesmo escopo do badge do app
- `week`: pendentes da semana movel
- `pending`: todas pendentes
- `overdue`: pendentes vencidas
- `upcoming`: pendentes futuras/agendadas
- `reminders`: pendentes com lembrete
- `completed`: concluidas

Esse endpoint tambem gera recorrencias vencidas antes de contar e sincroniza o badge.

### listTodayTasks()

Uso:

```ts
const result = await listTodayTasks({ limit: 50 });
```

Quando usar:

- tela `Meu Dia`
- resumo do dia atual
- relogio/status do dia

Inclui todos os status relevantes para hoje:

- pendentes planejadas para hoje
- pendentes com vencimento hoje
- pendentes vencidas antes de hoje
- concluidas planejadas para hoje
- concluidas com vencimento hoje
- concluidas hoje

Importante:

```text
O badge continua contando apenas pendentes do Meu Dia.
Completed tasks podem aparecer na lista, mas nao contam no badge.
```

### listWeekTasks()

Uso:

```ts
const result = await listWeekTasks({ limit: 100 });
```

Quando usar:

- tela `Minha Semana`
- planejamento dos proximos 7 dias a partir de hoje

Inclui todos os status relevantes da semana movel:

- pendentes vencidas
- tasks com `plannedFor` entre hoje e hoje + 6 dias
- tasks com `dueAt` entre hoje e hoje + 6 dias
- concluidas dentro da semana

### listPendingTasks()

Uso:

```ts
const result = await listPendingTasks({ limit: 100 });
```

Quando usar:

- tela de pendentes
- filtros de trabalho aberto
- buscas que devem ignorar concluidas

Inclui apenas:

```text
status = pending
```

### listOverdueTasks()

Uso:

```ts
const result = await listOverdueTasks({ limit: 100 });
```

Quando usar:

- tela de vencidas
- contador de risco/atraso

Inclui apenas:

```text
status = pending
dueAt < now
```

### listUpcomingTasks()

Uso:

```ts
const result = await listUpcomingTasks({ limit: 100 });
```

Quando usar:

- tela `Agendadas`
- planejamento futuro
- tasks que ainda nao pertencem ao dia atual

Significado atual:

```text
tasks pendentes com plannedFor > today
OU dueAt date > today
```

Observacao de produto:

```text
Se "upcoming" ficar confuso, o nome de UI recomendado e "Agendadas" ou "Futuras".
```

### listReminderTasks()

Uso:

```ts
const result = await listReminderTasks({ limit: 100 });
```

Quando usar:

- tela de lembretes
- painel de tasks que possuem notificacao configurada

Inclui apenas:

```text
status = pending
reminderAt != null
```

### listCompletedTasks()

Uso:

```ts
const result = await listCompletedTasks({ limit: 100 });
```

Quando usar:

- tela de concluidas
- historico basico de tasks finalizadas

Inclui apenas:

```text
status = completed
```

## Endpoint Legado / Lab

### listTasks()

Uso:

```ts
const result = await listTasks();
```

Retorna `TaskCollection`, com varios recortes no mesmo payload:

```ts
type TaskCollection = {
  tasks: Task[];
  myDay: Task[];
  myWeek: Task[];
  pending: Task[];
  overdue: Task[];
  upcoming: Task[];
  withReminders: Task[];
  completed: Task[];
  checklistItems: ChecklistItem[];
  reminders: PersistedReminder[];
  badge: BadgeSnapshot;
};
```

Regra:

```text
Nao usar em telas reais como estrategia padrao.
Usar apenas para compatibilidade, testes manuais, labs ou telas temporarias.
```

## Ordenacao Oficial

O backend Rust ordena as tasks antes de retornar.

Regras:

- pendentes vencidas aparecem primeiro
- pendentes com `dueAt` futuro aparecem depois, da data/hora mais proxima para a mais distante
- pendentes sem `dueAt` aparecem depois das tasks com vencimento, ordenadas por `createdAt`
- concluidas aparecem por ultimo, ordenadas por conclusao mais recente

Observacoes:

- `dueAt` e o campo oficial de vencimento e manda na prioridade da lista
- `reminderAt` nao muda a ordem principal; ele serve para notificacao e filtros de lembrete
- `plannedFor` nao muda a ordem principal; ele serve para pertencer ao Meu Dia/Minha Semana
- a UI deve renderizar na ordem recebida da API, sem reordenar localmente

## Badge

O badge do app nao e o tamanho da lista atual.

Regra:

```text
badge = quantidade de tasks pendentes do Meu Dia
```

Conta:

- pendentes planejadas para hoje
- pendentes com vencimento hoje
- pendentes vencidas antes de hoje
- pendentes cujo horario de vencimento de hoje ja passou

Nao conta:

- concluidas
- futuras
- tasks apenas com lembrete futuro

## Exemplo Em Uma Tela

```ts
import { onMounted } from "vue";
import { listTodayTasks } from "@/shared/lib/tasks/task.service";

const tasks = ref([]);
const checklistItems = ref([]);
const reminders = ref([]);

onMounted(async () => {
  const result = await listTodayTasks({ limit: 50 });

  tasks.value = result.tasks;
  checklistItems.value = result.checklistItems;
  reminders.value = result.reminders;
});
```

## Requisito De Frontend

O frontend do Praxis e desktop-first e deve seguir a estetica E-Ink:

- cores dessaturadas
- contraste legivel
- tokens semanticos
- nada de cores SaaS chamativas
- listas densas, mas calmas e escaneaveis
