> Direção atualizada em 13/10/2026: o usuário esclareceu que deseja um canvas flexível de desenho e sketch inspirado na interação do Miro e Excalidraw. Novos quadros começam vazios; ferramentas de desenho têm prioridade; tarefas são uma integração opcional. O modelo específico de refinamento descrito na proposta original abaixo foi substituído.

# Board infinito do Praxis — proposta de produto e implementação

Status: refinamento aprovado para uso pessoal, compartilhamento de tela e exportação; primeira implementação em validação. Data: 13/10/2026. O criador confirmou prioridade para todos os tipos de conteúdo. Estado implementado e limites: [BOARDS.md](BOARDS.md).

## 1. Problema e direção

O objetivo informado pelo criador é centralizar seu trabalho: desenhos, entendimento, dúvidas, decisões e execução hoje estão distribuídos em ferramentas diferentes. O caso inicial é o desenvolvedor frontend participando de refinamentos.

A promessa proposta para o Praxis é: **entender o trabalho, preservar o contexto e executar sem perder decisões ou compromissos**.

O board é um espaço visual persistente dentro do Praxis. Deve permitir desenho livre e organização espacial, além de conectar esse material às tarefas existentes. O diferencial a validar é conseguir continuar o trabalho após a reunião sem reconstruir o contexto em outro aplicativo.

Isso amplia deliberadamente a proposta original de execução pessoal e planejamento simples. A direção foi confirmada pelo criador e incorporada ao README. As visões Meu Dia, Minha Semana, lembretes e badge continuam com suas regras atuais; elementos gráficos não são automaticamente tarefas.

## 2. Fatos, hipóteses e decisões abertas

Fatos da análise inicial, anteriores à implementação (as correções estão descritas em BOARDS.md):

- Interface Vue 3/TypeScript, backend Tauri/Rust, estado compartilhado em Pinia.
- Rotas privadas exigem cofre aberto, por meio do guard em `src/app/router.ts`.
- Tarefas possuem contratos e serviços próprios; o board deve reutilizá-los.
- `read_active_document` lê e descriptografa o documento completo.
- `write_active_document` verifica alteração externa, cria cópia de segurança e criptografa/grava o documento completo.
- A leitura e a escrita atuais adquirem o mutex em etapas separadas; isso não garante uma transação envolvendo todo o ciclo de uma mutação.
- A escrita final usa `fs::write`, sem protocolo de substituição atômica implementado nesse helper.
- O projeto ainda não tem um editor de board.

Hipóteses a validar com uso real:

- A primeira versão pode atender uso pessoal durante compartilhamento de tela, sem edição simultânea.
- Fluxos, estados de telas, screenshots, dúvidas e decisões são os conteúdos mais frequentes.
- Templates opcionais ajudam a preparar uma reunião, mas o board vazio continua útil.
- Centralização será útil se reduzir a necessidade de procurar contexto depois da reunião.

Decisões confirmadas: uso pessoal e compartilhamento de tela, com exportação; todos os tipos de conteúdo são prioritários. Permanecem para validação o volume habitual de imagens e a necessidade de formatos adicionais de compartilhamento.

## 3. Fluxo principal

1. Abrir Boards e criar um board vazio ou usar o template opcional Refinamento frontend.
2. Informar título e, opcionalmente, link da demanda externa. O link é uma referência, sem integração automática.
3. Organizar o entendimento com texto, formas, conectores, desenho livre e imagens.
4. Registrar dúvidas e decisões como cartões identificáveis e pesquisáveis.
5. Selecionar uma pendência e escolher Criar tarefa, ou vincular uma tarefa existente.
6. Confirmar título e demais campos pelo fluxo normal de tarefas. A relação preserva a origem no board.
7. Retomar a tarefa em Meu Dia e acessar seu contexto visual; voltar ao board foca o cartão correspondente.
8. Reabrir o board na próxima sessão com conteúdo salvo e indicadores claros de dúvidas abertas e tarefas vinculadas.

Exemplo: no refinamento de checkout, desenhar carregamento, sucesso, erro e nova tentativa; anotar uma dúvida sobre a API; registrar a regra confirmada; criar a tarefa Implementar tratamento de erro ligada à decisão e ao fluxo.

## 4. Escopo do primeiro lançamento

### Editor e navegação

- Criar, renomear, listar, pesquisar, duplicar e excluir boards com confirmação adequada.
- Pan, zoom ancorado no cursor, voltar ao conteúdo e ajustar a seleção à tela.
- Texto, notas, retângulos/elipses, setas/conectores ligados a elementos e desenho livre.
- Seleção simples e múltipla, mover, redimensionar, duplicar, excluir e organizar ordem visual.
- Undo/redo de operações do board, agrupando um arraste ou um traço em uma ação.
- Inserir imagens locais ou do clipboard com limites explícitos de tamanho e tratamento de formato; sem buscar imagens remotas automaticamente.
- Salvamento automático agrupado; estados Salvo, Salvando, Alterações não salvas e Falha ao salvar.
- Os cinco temas do aplicativo; toolbar discreta, foco no espaço de trabalho e painel de propriedades contextual.
- Exportação inicial PNG de uma seleção ou frame. A exportação é explícita e pode conter dados sensíveis em texto claro.

### Contexto de refinamento

- Cartão de contexto: texto livre para objetivo ou regra.
- Cartão de dúvida: aberta/resolvida, com resposta opcional.
- Cartão de decisão: conclusão, justificativa e referências opcionais.
- Cartão de tarefa: referência a uma tarefa real, com título/status derivados do domínio de tarefas.
- Frames opcionais para agrupar visualmente uma tela, fluxo ou assunto.
- Painel textual para localizar elementos, dúvidas e tarefas, inclusive por teclado.
- Imagens com descrição editável e estados identificados por texto/ícone, além da cor.
- Template opcional com Objetivo, Fluxo e estados, Regras, Dúvidas, Decisões e Próximas ações.

Critérios de aceite e estados de tela podem ser registrados em texto no primeiro recorte. Bibliotecas de componentes, wireframes avançados e estados executáveis não são necessários para validar a centralização.

Fases posteriores: PDF/SVG e exportação editável, histórico durável do board, comentários, integração com ferramentas externas e colaboração simultânea. Uma demanda por colaboração na primeira versão exige revisar essa divisão antes de implementar.

## 5. Regras entre board e tarefas

- Um cartão referencia `taskId`; não duplica o estado oficial da tarefa.
- Uma tarefa pode ser referenciada em mais de um board.
- Mover/apagar um cartão não conclui nem apaga a tarefa.
- Excluir um board preserva suas tarefas; referências à origem removida recebem tratamento explícito.
- Uma tarefa removida deixa uma referência identificada como indisponível, sem recriação silenciosa.
- Desfazer no canvas atua no board. Criar/concluir/excluir tarefas continua sendo ação explícita do domínio de tarefas; undo do canvas não apaga tarefas silenciosamente.
- Criar tarefa e vincular sua origem deve ser uma mutação transacional do documento com identificador de operação para impedir duplicação em retries.
- Atualização de título/status de tarefa deve aparecer nos cartões vinculados sem polling permanente.
- Tarefas arquivadas continuam identificáveis; acesso ao histórico respeita os fluxos atuais de arquivamento.
- Apenas tarefas entram em contagens, lembretes e recorrência. Dúvidas e decisões têm indicadores próprios.

## 6. Modelo e limites sugeridos

Modelo sugerido, ainda não implementado:

- Board: identificador, título, datas, versão de formato e revisão.
- Elemento: identificador, board, tipo, posição, dimensões, ordem visual e propriedades validadas específicas do tipo.
- Conector: referências às extremidades e pontos livres quando não estiver conectado a um elemento.
- Referência de tarefa: elemento e taskId; sem cópia persistida de título/status.
- Imagem: identificador do asset, formato, dimensões e conteúdo protegido; o elemento referencia o asset.
- Dúvida/decisão: conteúdo e estado próprios, associados ao elemento.

Persistir dados do domínio, não objetos vivos de uma biblioteca gráfica. A câmera e a seleção são estado de interface, não mutações do conteúdo do board. Posição de câmera pode ser lembrada como preferência local, sem conteúdo sensível e sem gravação a cada movimento.

Boards devem estar no cofre. Nada de conteúdo descriptografado em localStorage, logs ou arquivos temporários de recuperação. Ao bloquear, remover conteúdo e imagens da memória do editor e liberar URLs de objetos.

Adicionar múltiplos boards não exige pastas/projetos para tarefas. Lista simples com busca e últimos acessados atende o primeiro recorte.

## 7. Alternativas para o editor

| Alternativa | Benefício | Custo e risco | Uso proposto |
| --- | --- | --- | --- |
| Excalidraw embutido localmente | Editor pronto reduz o trabalho de ferramentas e gestos | Componente React em aplicação Vue; ponte de lifecycle, cartões de tarefa, temas e estado exigem prova técnica | Candidato para acelerar desenho, se integração real for satisfatória |
| Vue + Konva | Integração Vue e controle sobre cartões e experiência do Praxis | Konva é base gráfica, não um editor pronto; seleção, conectores, texto e undo precisam ser implementados | Candidato para uma experiência integrada com escopo controlado |
| Editor próprio baseado em SVG/DOM | Controle e pouca infraestrutura inicial | Muitos gestos, geometria e renderização para manter; limites com cenas grandes precisam ser medidos | Comparação simples na prova técnica, sem assumir que será suficiente |
| tldraw | SDK de editor com recursos prontos | Integração React e licença de produção a avaliar | Alternativa secundária condicionada ao encaixe e custo |

Recomendação: prova técnica curta comparando Excalidraw e Vue/Konva com o mesmo cenário: desenhar um fluxo, editar texto, conectar elementos, exibir um cartão de tarefa, salvar/reabrir e aplicar os temas. Escolher pelo resultado medido, não apenas pela demonstração visual.

Excalidraw exige React/React DOM e por padrão pode carregar fontes de CDN; para o Praxis os assets devem ser empacotados localmente. Konva documenta integração Vue 3. tldraw exige chave para produção. Nenhuma dessas dependências foi instalada como parte desta proposta.

Fontes consultadas:

- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation
- https://konvajs.org/docs/vue/index.html
- https://tldraw.dev/sdk-features/license-key

## 8. Persistência segura e desempenho

Salvar a cada movimento de ponteiro multiplicaria criptografia, escrita do cofre e cópias de segurança. Recomendação: atualizar a interação em memória, confirmar operações ao encerrar o gesto e agrupar gravações por período curto de inatividade, com um limite máximo de espera a definir por teste. Não iniciar outra gravação até a anterior finalizar.

O backend deve aplicar a alteração ao documento atual sob uma fronteira transacional compartilhada por todas as mutações do cofre. Apenas colocar uma fila no frontend ou lock no comando do board não impede uma gravação concorrente de tarefa/lembrete de perder conteúdo. Verificar revisão esperada e rejeitar alteração obsoleta com erro tratável.

Antes de autosave frequente: implementar escrita segura em arquivo temporário protegido no mesmo diretório e substituição final com comportamento Windows validado; preservar fingerprint e cópias de recuperação; definir política de retenção dessas cópias sem remover dados existentes silenciosamente.

Primeiro experimento: boards pequenos no documento criptografado atual, com limites medidos. Assets grandes elevam o custo de todas as gravações. Se os testes excederem os limites acordados, separar conteúdo/attachments em armazenamento criptografado próprio com migração e portabilidade explícitas. Não prometer escala ilimitada nem migrar todo o banco antes da medição.

O canvas é uma câmera sobre coordenadas de mundo, não um bitmap de dimensões ilimitadas. Renderizar região visível quando necessário, manter histórico de undo limitado e liberar o editor ao sair. Carregar o módulo apenas ao abrir Boards; não manter loop de renderização no tray quando o board estiver ocioso.

Em erro de escrita, manter alterações em memória e indicar que não foram salvas. Sair, bloquear ou fechar com alterações pendentes deve oferecer retry ou descarte explícito. Alteração externa deve pausar autosave e nunca pode provocar sobrescrita ou reload automático que descarte o desenho. A cópia atual de conflito preserva o arquivo do disco, não o rascunho ainda em memória. Recuperação após crash exige estratégia criptografada própria; não está garantida apenas por autosave em memória.

## 9. Plano de implementação

1. Confirmar cenário pessoal/colaborativo e conteúdo prioritário; validar com um refinamento real e definir o que se perde hoje.
2. Provar editor, gestos, tarefa vinculada e carregamento local no WebView2; medir tamanho do bundle e consumo de memória.
3. Definir contratos versionados, migração e mutação transacional do cofre; testar concorrência e escrita interrompida.
4. Entregar fluxo vertical: criar board, adicionar texto/forma, mover, salvar, fechar/reabrir e respeitar bloqueio.
5. Completar ferramentas, conectores, imagens limitadas, undo/redo e navegação por teclado.
6. Integrar dúvidas, decisões, criação/vínculo de tarefas e navegação de volta ao contexto.
7. Adicionar template, exportação e tratamento de conflito/erro; validar em refinamentos reais.

Caminhos sugeridos: `src/features/boards`, `src/pages/boards`, `src/shared/types/board.ts`, `src/stores/board.store.ts` e `src-tauri/src/boards.rs`. O código existente deve ser inspecionado novamente antes da implementação.

## 10. Validação e critérios de sucesso

- Reabrir o app preserva elementos, conectores, dúvidas, decisões e relações com tarefas.
- Cofres antigos continuam abrindo; migração é validada com cópia de segurança e rejeição explícita de formato incompatível.
- Criar tarefa vinculada não duplica em retry e não perde alterações concorrentes de tarefas, lembretes ou board.
- Undo/redo de desenho não modifica estado de tarefas inesperadamente.
- Falha ao gravar, alteração externa, saída com mudanças e bloqueio do cofre têm recuperação testada.
- Testar pan/zoom, seleção, texto e atalhos no Windows com mouse, trackpad e escala de tela; atalhos não interceptam campos de texto.
- Testar contraste em todos os temas e acesso textual por teclado; canvas sozinho não atende navegação acessível.
- Fixtures de 100, 1.000 e 5.000 elementos e imagens com volume definido: medir tempo de abertura, latência de interação, memória, duração e bytes por gravação, e crescimento das cópias. São cenários de teste, não capacidade prometida.
- Critério preliminar de interação: frame de até 16,7 ms durante pan/arraste no hardware de referência a registrar; aceitar ou ajustar com medição real.
- Abrir/reabrir o app sem editar não deve criar cópias do cofre; edição de um arraste não deve gravar uma vez por pixel.
- Em uma sessão real, recuperar a decisão que originou uma tarefa sem procurar outro aplicativo. Registrar dúvidas resolvidas, compromissos esquecidos e número de transferências manuais entre ferramentas antes/depois.

Comandos de validação de implementação: `npm run build`, `npm run test:unit`, `npm run tauri info`, testes Rust apropriados e `npm run tauri build`, além do teste manual no aplicativo. Esta proposta documental não equivale a um board implementado ou validado.
