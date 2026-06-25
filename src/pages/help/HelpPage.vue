<script setup lang="ts">
import {
	Bell,
	CalendarDays,
	CheckCircle2,
	Clock3,
	Hash,
	HelpCircle,
	HeartHandshake,
	KeyRound,
	LockKeyhole,
	Moon,
	Plus,
	Settings,
	ShieldCheck,
	Sun,
} from "@lucide/vue";

import HelpKey from "@/features/help/components/HelpKey.vue";
import HelpSteps from "@/features/help/components/HelpSteps.vue";
import HelpTaskPreview from "@/features/help/components/HelpTaskPreview.vue";
import HelpTopic from "@/features/help/components/HelpTopic.vue";
import HelpCreatorSupport from "@/features/help/components/HelpCreatorSupport.vue";

const topics = [
	{ id: "comece", label: "Primeiros passos", icon: KeyRound },
	{ id: "criar", label: "Criar tarefas", icon: Plus },
	{ id: "visoes", label: "Organizar o dia", icon: CalendarDays },
	{ id: "lembretes", label: "Datas e lembretes", icon: Bell },
	{ id: "detalhes", label: "Checklist e tags", icon: Hash },
	{ id: "concluir", label: "Concluir e arquivar", icon: CheckCircle2 },
	{ id: "privacidade", label: "Cofre e configurações", icon: ShieldCheck },
	{ id: "sobre", label: "Sobre e apoiar", icon: HeartHandshake },
];

const vaultSteps = [
	"Selecione um arquivo .praxis existente ou escolha onde criar um novo cofre.",
	"Informe a senha. O conteúdo só é aberto depois que a senha correta for validada.",
	"Use Sair para bloquear o cofre. Enquanto estiver desbloqueado, fechar a janela mantém lembretes e badge ativos.",
];

const reminderSteps = [
	"Defina o vencimento para indicar quando a tarefa precisa estar pronta.",
	"Defina um lembrete somente quando quiser receber uma notificação em um horário específico.",
	"Mantenha as notificações habilitadas nas Configurações e no Windows.",
];

function scrollToTopic(topicId: string) {
	document.getElementById(topicId)?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
}
</script>

<template>
  <section class="mx-auto grid max-w-5xl gap-8">
    <header class="grid gap-4 border-b border-border pb-7">
      <div class="flex items-center gap-3 text-blue">
        <HelpCircle :size="24" />
        <span class="text-caption font-semibold uppercase">Central de ajuda</span>
      </div>
      <div class="grid max-w-3xl gap-2">
        <h1 class="text-display text-ink">Como usar o Praxis</h1>
        <p class="text-body leading-6 text-ink-soft">
          Um guia curto para registrar o que importa, receber o aviso certo e terminar o
          dia sem pendências esquecidas.
        </p>
      </div>

      <div class="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
        <HelpKey
          :keys="['Ctrl', 'N']"
          label="Criar no contexto atual"
        />
        <HelpKey
          :keys="['Ctrl', 'Shift', 'N']"
          label="Criar tarefa livre"
        />
      </div>
    </header>

    <div class="grid items-start gap-8 desktop:grid-cols-[13rem_minmax(0,1fr)]">
      <nav
        class="grid gap-1 desktop:sticky desktop:top-8"
        aria-label="Tópicos da ajuda"
      >
        <span class="mb-2 text-caption font-semibold uppercase text-ink-muted"
          >Neste guia</span
        >
        <button
          v-for="topic in topics"
          :key="topic.id"
          type="button"
          class="flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left text-body text-ink-soft hover:border-blue hover:bg-hover hover:text-ink"
          @click="scrollToTopic(topic.id)"
        >
          <component
            :is="topic.icon"
            :size="17"
          />
          <span>{{ topic.label }}</span>
        </button>
      </nav>

      <main class="grid gap-10">
        <HelpTopic
          id="comece"
          eyebrow="01 · acesso"
          title="Abra seu cofre"
          description="O arquivo .praxis é a fonte dos seus dados. Ele permanece local e criptografado, inclusive quando estiver em uma pasta sincronizada por você."
          :icon="KeyRound"
        >
          <HelpSteps :steps="vaultSteps" />

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <span class="text-caption font-semibold uppercase text-ink-muted"
                >Cofre existente</span
              >
              <div
                class="flex items-center gap-3 border border-border bg-paper px-3 py-3"
              >
                <LockKeyhole
                  :size="19"
                  class="text-blue"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-body font-semibold text-ink">planejamento.praxis</p>
                  <p class="truncate text-small text-ink-muted">
                    C:\...\Praxis\planejamento.praxis
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 text-small font-semibold text-sage">
                <ShieldCheck :size="16" />
                Cofre reconhecido
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="criar"
          eyebrow="02 · captura"
          title="Crie sem perder o contexto"
          description="O Praxis oferece uma criação contextual e outra livre. Assim você registra rápido sem abrir mão de controlar datas, lembrete, nota, tag e checklist."
          :icon="Plus"
        >
          <div class="grid gap-5">
            <div class="grid gap-2">
              <HelpKey
                :keys="['Ctrl', 'N']"
                label="Usa a tela e o dia atual como contexto."
              />
              <p class="text-body leading-6 text-ink-soft">
                Em Meu Dia, a tarefa recebe vencimento para hoje. Em Minha Semana, recebe
                o dia selecionado no calendário.
              </p>
            </div>
            <div class="grid gap-2">
              <HelpKey
                :keys="['Ctrl', 'Shift', 'N']"
                label="Abre uma tarefa sem data predefinida."
              />
              <p class="text-body leading-6 text-ink-soft">
                Use quando quiser preencher cada detalhe manualmente ou apenas guardar uma
                pendência sem prazo.
              </p>
            </div>
          </div>

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <span class="text-caption font-semibold uppercase text-ink-muted"
                >Nova tarefa</span
              >
              <div class="border border-blue bg-paper px-3 py-2 text-body text-ink">
                Preparar apresentação
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  class="border border-border bg-paper px-3 py-2 text-small text-ink-soft"
                >
                  Hoje · 16:00
                </div>
                <div
                  class="border border-border bg-paper px-3 py-2 text-small text-ink-soft"
                >
                  Lembrete · 15:30
                </div>
              </div>
              <div class="flex justify-end">
                <span class="bg-accent px-3 py-2 text-small font-semibold text-on-accent"
                  >Criar tarefa</span
                >
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="visoes"
          eyebrow="03 · foco"
          title="Use cada visão para uma pergunta"
          description="As telas não são pastas. Cada uma responde a uma pergunta prática e carrega somente as tarefas necessárias."
          :icon="CalendarDays"
        >
          <div class="grid border-t border-border">
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">Meu Dia</strong>
              <span class="text-body text-ink-soft"
                >O que venceu, vence hoje ou foi concluído hoje.</span
              >
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">Minha Semana</strong>
              <span class="text-body text-ink-soft"
                >Os próximos sete dias, começando amanhã.</span
              >
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">Pendentes</strong>
              <span class="text-body text-ink-soft"
                >Tudo que continua aberto, agrupado por urgência.</span
              >
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">Lembretes</strong>
              <span class="text-body text-ink-soft"
                >Somente pendentes que possuem uma notificação configurada.</span
              >
            </div>
          </div>

          <template #visual>
            <div class="grid grid-cols-4 gap-2 border border-border bg-surface p-4">
              <div
                class="grid h-20 place-items-center border border-blue bg-blue text-on-accent"
              >
                <span class="text-small">Ter</span
                ><strong class="text-heading">23</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">Qua</span
                ><strong class="text-heading">24</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">Qui</span
                ><strong class="text-heading">25</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">Sex</span
                ><strong class="text-heading">26</strong>
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="lembretes"
          eyebrow="04 · tempo"
          title="Vencimento e lembrete têm funções diferentes"
          description="Vencimento define urgência e atraso. Lembrete define quando o Windows deve chamar sua atenção."
          :icon="Bell"
        >
          <HelpSteps :steps="reminderSteps" />

          <template #visual>
            <HelpTaskPreview
              title="Enviar proposta comercial"
              note="Vence às 16:00 e avisa trinta minutos antes."
              show-reminder
            />
          </template>
        </HelpTopic>

        <HelpTopic
          id="detalhes"
          eyebrow="05 · execução"
          title="Quebre o trabalho sem criar novas obrigações"
          description="Checklist e tags enriquecem a tarefa, mas somente a tarefa principal possui vencimento, lembrete, recorrência e participação no badge."
          :icon="Hash"
        >
          <div class="grid gap-4">
            <p class="text-body leading-6 text-ink-soft">
              Use o checklist para passos visuais. Quando todos os itens forem concluídos,
              a tarefa principal também será concluída automaticamente.
            </p>
            <p class="text-body leading-6 text-ink-soft">
              Use tags para identificar contextos como trabalho, pessoal ou financeiro.
              Renomear ou recolorir uma tag atualiza todas as tarefas relacionadas.
            </p>
            <p class="text-body leading-6 text-ink-soft">
              Ao criar uma tarefa, digite <strong class="text-ink">+</strong> no título
              para procurar uma tag. Se o nome ainda não existir, confirme com Enter para
              criá-la e vinculá-la automaticamente.
            </p>
          </div>

          <template #visual>
            <HelpTaskPreview
              title="Preparar demonstração"
              note="2 de 3 passos concluídos"
              show-checklist
            />
          </template>
        </HelpTopic>

        <HelpTopic
          id="concluir"
          eyebrow="06 · histórico"
          title="Conclua, reabra ou restaure"
          description="O Praxis preserva o ciclo de vida da tarefa para que o histórico continue útil sem ocupar as visões de trabalho."
          :icon="CheckCircle2"
        >
          <div class="grid gap-4 text-body leading-6 text-ink-soft">
            <p>Clique no indicador da tarefa para alternar entre pendente e concluída.</p>
            <p>
              Tarefas concluídas antigas podem ser arquivadas automaticamente conforme a
              política escolhida nas Configurações.
            </p>
            <p>
              Na tela Arquivadas, use o ícone azul de restauração ao lado da lixeira. A
              data original de conclusão é preservada.
            </p>
          </div>

          <template #visual>
            <div class="grid gap-3">
              <HelpTaskPreview
                title="Revisar contrato"
                state="completed"
              />
              <HelpTaskPreview
                title="Fechar planejamento anual"
                state="archived"
              />
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="privacidade"
          eyebrow="07 · controle"
          title="Ajuste o app sem expor seu cofre"
          description="Configurações reúne aparência, notificações, badge, inicialização, retenção e indicadores técnicos seguros."
          :icon="Settings"
        >
          <div class="grid gap-4">
            <p class="text-body leading-6 text-ink-soft">
              O status do banco mostra se o cofre está aberto, quando o arquivo foi
              atualizado e se a criptografia está ativa, sem revelar senha ou conteúdo.
            </p>
            <p class="text-body leading-6 text-ink-soft">
              Escolha entre os temas E-Ink claro e escuro. As cores de prioridade
              permanecem estáveis nos dois modos.
            </p>
          </div>

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <div class="flex items-center justify-between border-b border-border pb-3">
                <span class="flex items-center gap-2 text-body text-ink"
                  ><ShieldCheck :size="17" /> Criptografia</span
                >
                <strong class="text-small text-sage">Ativa</strong>
              </div>
              <div class="grid grid-cols-2 border border-border bg-paper p-1">
                <span
                  class="flex items-center justify-center gap-2 bg-ink px-3 py-2 text-small text-paper"
                >
                  <Sun :size="15" /> Papel
                </span>
                <span
                  class="flex items-center justify-center gap-2 px-3 py-2 text-small text-ink-soft"
                >
                  <Moon :size="15" /> Escuro
                </span>
              </div>
              <div class="flex items-center gap-2 text-small text-ink-muted">
                <Clock3 :size="15" />
                Última atualização registrada localmente
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="sobre"
          eyebrow="08 · sobre"
          title="Feito com cuidado, apoiado por quem acredita"
          description="Conheça quem está por trás do Praxis e, se fizer sentido para você, ajude a manter o projeto evoluindo."
          :icon="HeartHandshake"
        >
          <HelpCreatorSupport />

          <template #visual>
            <div class="grid gap-4 border border-border bg-surface p-5">
              <div class="flex h-12 w-12 items-center justify-center border border-border bg-paper text-accent">
                <HeartHandshake :size="24" />
              </div>
              <div class="grid gap-2">
                <span class="text-heading text-ink">Praxis continua simples</span>
                <p class="text-body leading-6 text-ink-soft">
                  O apoio financia evolução e manutenção, não a criação de barreiras para
                  quem só precisa organizar o próprio dia.
                </p>
              </div>
              <div class="border-l-2 border-sage pl-3 text-small leading-5 text-ink-muted">
                Privacidade local, lembretes confiáveis e uma experiência calma continuam
                sendo o centro do produto.
              </div>
            </div>
          </template>
        </HelpTopic>

        <footer
          class="flex flex-wrap items-center justify-between gap-4 border-t border-border py-6"
        >
          <div class="grid gap-1">
            <span class="text-heading text-ink">Pronto para voltar ao trabalho</span>
            <span class="text-body text-ink-soft"
              >O essencial cabe em criar, lembrar e concluir.</span
            >
          </div>
          <RouterLink
            to="/app/today"
            class="flex items-center gap-2 bg-blue px-4 py-2 text-body font-semibold text-on-accent"
          >
            <CalendarDays :size="17" />
            Ir para Meu Dia
          </RouterLink>
        </footer>
      </main>
    </div>
  </section>
</template>
