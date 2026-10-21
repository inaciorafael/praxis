# Post-its independentes

Post-its são notas livres, separadas de tarefas, lembretes e Papers.
Não exigem data, tarefa ou agendamento. Criar, editar, arquivar e retirar um Post-it não altera compromissos nem notificações.

## Experiência

- Seção própria com Novo Post-it, título opcional, texto livre e quatro cores suaves.
- Salvar pode fixar a nota imediatamente no desktop ou apenas guardá-la.
- Editar no desktop abre o editor da própria nota na seção Post-its.
- Cabeçalho arrastável, recolher/expandir e retirar da tela.
- Retirar mantém o conteúdo salvo. Arquivar guarda a nota e retira sua janela; restaurar não fixa automaticamente.
- Até três janelas simultâneas; notas adicionais fixadas aguardam na fila.
- Janelas sem decoração ou item na barra de tarefas, acima de janelas comuns, sem tomar foco ao aparecer.
- Notas permanecem disponíveis enquanto Praxis está executando com o cofre aberto. Bloquear, trocar cofre ou sair destrói as janelas.

## Persistência e compatibilidade

A coleção opcional desktopPostits fica no cofre criptografado.
Cada nota tem id próprio, title, body, revision, pinned, collapsed, archived, completedAt e color.
Revisões impedem sobrescrever alterações concorrentes. Limites: 500 notas, título de 200 caracteres e texto de 10.000 caracteres.
Geometria local fica nas configurações do dispositivo, sem conteúdo em texto puro.
Leituras não gravam o cofre. Registros antigos vinculados a tarefas são apresentados como notas livres copiando seu título; a próxima mutação materializa a separação sem alterar a tarefa original.
Não há integração com conclusão de tarefas, badges ou horários de lembretes.

## Validação

Testes de domínio cobrem criação sem tarefas, revisão concorrente, conclusão, expiração no limite exato, reabertura e compatibilidade dos registros antigos.
Testes de UI cobrem texto livre, ações distintas e preservação do rascunho em erro.
A restauração de posições em múltiplos monitores e visibilidade em tela cheia exclusiva ainda exigem validação específica no Windows.

Arquivos antigos sem completedAt recebem o início do prazo na primeira sincronização após a atualização; nenhum concluído antigo recebe retenção indefinida. archived permanece apenas como campo interno compatível; a ação de produto é Concluído.

## Edicao rapida

- Alt+N na secao abre uma nova nota com foco no texto; titulo e opcional.
- Ctrl+Enter (ou Command+Enter) salva sem navegar entre campos.
- Editar no desktop e duplo clique no texto abrem o editor na propria janela.
- Enquanto edita, recolher e retirar ficam bloqueados. Cancelar descarta apenas o rascunho local.
- O envio usa a revisao capturada ao iniciar a edicao. Eventos concorrentes nao substituem o texto digitado; erros preservam o rascunho.

## Preferencias locais

AppConfig.postitPreferences controla desktopEnabled, desktopLimit (1 a 3), pinNew e color (yellow/pink/green/blue). Valores antigos usam os padroes atuais. Desativar desktop nao conclui, apaga nem altera notas. A cor e pinNew so se aplicam a novas notas. A retencao de concluidos continua fixa em sete dias.


## Post-its adaptativos implementados

Cada nota guarda seu modo individual: Micro (180 × 40), Compacto (248 × 132) ou Expandido (340 × 380 inicialmente). O modo expandido permite ajustar entre 280–600 × 220–700, limitado também à área útil do monitor. O título vazio usa a primeira linha do conteúdo para identificação.

Hover ou foco em Micro abre uma prévia após 300 ms; Espaço abre leitura completa e Enter/Editar abre a edição. Escape fecha a prévia ou conclui a edição salvando. Texto é salvo após 600 ms de pausa, sem montar editores nas outras notas. Manter modo desativa a prévia automática. Falhas e conflitos preservam o rascunho; um conflito de conteúdo não é sobrescrito.

Posição permanente, tamanho preferido e interação temporária têm estados separados. A expansão é ancorada e limitada à área útil, sem reorganizar outras janelas nem salvar deslocamentos produzidos pela prévia. Arraste salva a posição depois de cessarem os movimentos. O redimensionamento transmite somente a última dimensão pendente e persiste no término; há campos numéricos acessíveis por teclado.

Seleção múltipla no organizador cria pilhas nomeadas. Uma pilha ocupa uma única janela e abre uma lista temporária; apenas a nota acessada monta o editor. Desagrupar mantém conteúdo, cores, modos, fixação e as chaves de posição de cada membro. A busca encontra e destaca título/conteúdo de notas agrupadas e individuais, sem alterar posições.

### Compatibilidade e armazenamento

O cofre criptografado existente continua sendo a fonte. Campos opcionais em desktopPostits: preferredMode, modeLocked, expandedSize e groupId. A coleção opcional postitGroups guarda id, nome e revisão. Na leitura de registros antigos, collapsed=true corresponde a Micro e false a Expandido. Ler não regrava o documento; a próxima alteração materializa os novos campos. Notas novas começam em Compacto. As posições permanecem em AppConfig.postitPositions, com as mesmas chaves das notas antigas. Nenhuma migração remove conteúdo ou altera tarefas.

### Limites e verificação

O limite configurável de 1–3 janelas nativas é mantido; uma pilha conta como uma janela. Até 500 notas e 250 pilhas são aceitas no cofre. Concluídas continuam recuperáveis por sete dias. Não há sincronização adicional nem nova dependência. Testes cobrem migração sem escrita, revisões, agrupamento atômico, restauração de membros, ancoragem em monitor negativo, hover, bloqueio de modo, teclado, autosave, conflitos e busca. A configuração com múltiplos monitores e escalas distintas precisa também de validação em hardware real.
