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
