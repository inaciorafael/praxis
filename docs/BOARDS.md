# Papers do Praxis

## Papers

Paper é o conceito do canvas livre anteriormente chamado de Board/quadro, com fundo branco e ferramentas de escrita, formas, desenho, imagens e exportação. Existe uma única biblioteca Papers com todos os documentos antigos e novos. No editor de uma tarefa, junto às suas anotações, é possível criar um Paper, anexar um existente, abrir ou remover apenas o vínculo. Lembretes usam esse mesmo editor de tarefa.

Um Paper pode ser vinculado a várias tarefas. Seus contextos aparecem no canvas e permitem abrir a tarefa com seu checklist, inclusive arquivada. As alterações do formulário são salvas antes de abrir um Paper. Falhas de salvamento impedem a navegação e preservam o rascunho.

Os documentos continuam na seção criptografada `boards`. O campo legado `kind: board|paper` é mantido apenas por compatibilidade e não separa bibliotecas ou funcionalidades. Todos os documentos, inclusive sem tipo, podem ser anexados às tarefas. A rota antiga `/app/boards` redireciona para `/app/papers` preservando parâmetros de contexto. A seção `paperLinks` armazena referências entre tarefa e Paper. Criar e anexar um Paper ocorre em um único commit com identificador de operação para tentativas seguras. Abrir cofres antigos não cria essas seções. Excluir uma tarefa remove seus vínculos e preserva os Papers; excluir um Paper remove seus vínculos e preserva as tarefas. Duplicar um Paper copia o canvas sem copiar seus vínculos de contexto.

Anotações nesta versão pertencem às tarefas; o Paper é um documento separado vinculado a elas, sem inserir conteúdo visual no HTML das notas.

Quadros oferecem um canvas livre para desenhos simples, fluxos, sketches e referências visuais. Refinamentos são um uso possível, sem impor uma estrutura ou modelo. O conteúdo acompanha o cofre `.praxis` criptografado. Não há serviço de colaboração em tempo real.

## Uso

### Experiência de papel digital

A experiência principal usa o Concepts como referência de desenho e exploração de ideias. Ao abrir um Paper, o canvas ocupa a janela do aplicativo e a navegação geral é recolhida; Voltar ao Praxis restaura a navegação. Uma roda compacta oferece lápis, caneta, seleção, mão, texto e nota. Formas, conectores e imagens ficam na gaveta de ferramentas adicionais. Papers em branco começam com o lápis; lápis e caneta permanecem ativos entre traços.

O centro da roda abre os ajustes de traço: espessura de 0,5 a 32 pixels do espaço da cena, opacidade de 5% a 100% e cor livre. As escolhas configuram novos elementos ou modificam a seleção, com desfazer/refazer. Cor e opacidade também acompanham a escrita e a exportação; documentos antigos conservam as medidas anteriores quando a espessura não está definida. O backend valida os valores e as cores hexadecimais.

A galeria reúne os Papers por nome e quantidade real de elementos. Abrir a galeria durante um desenho não desmonta o canvas nem descarta seu rascunho. Cabeçalho, contextos de tarefas e detalhes ficam sobrepostos e compactos, liberando o papel. A seleção oferece ações de edição, estilo, duplicação e remoção. O modo sem distrações continua recolhendo inclusive a roda de ferramentas. Esta reconstrução implementa a experiência de navegação e desenho com as ferramentas existentes; camadas nomeadas, pressão de caneta e importação de PDF não fazem parte dessa implementação.

O botão Modo sem distrações abre o Paper em tela cheia no desktop e ocupa toda a janela com o canvas branco, sem navegação, título, biblioteca, detalhes ou barras de ferramentas. Mostrar ferramentas reexibe apenas os controles do desenho. Sair do modo sem distrações ou Esc retorna à visualização normal; Esc durante edição/gesto cancela essa interação antes de sair. O canvas e sua câmera não são recriados, e notas abertas no painel de tarefa são apenas ocultadas, preservando seu rascunho. A janela retorna ao estado de tela cheia anterior ao entrar no modo. Erros de salvamento continuam visíveis.

1. Abra Papers na navegação com o cofre desbloqueado. Todos os quadros já existentes aparecem nessa mesma biblioteca.
2. Crie um novo quadro: ele começa vazio. O modo de foco recolhe a navegação do aplicativo.
3. Use texto, notas, formas, quadros, conectores, desenho livre e imagens. A lista de pranchas pode ser recolhida para liberar espaço.
4. Abra Detalhes e elementos para selecionar um elemento pelo texto, alterar cor/conteúdo ou marcar uma dúvida como respondida.
5. Em cartões de texto, nota, dúvida, decisão ou tarefa, crie uma tarefa oficial ou vincule uma existente. Abrir tarefa carrega seu checklist atual. O editor da tarefa permite retornar à prancha de origem.
6. Use PNG para escolher um destino de exportação pelo diálogo nativo. O arquivo exportado é uma imagem comum, fora da proteção do cofre.

V: seleção; H: mão; R: retângulo; O: elipse; A: seta; P: desenho livre; T: texto; N: nota; F: quadro. Enter edita o texto do elemento selecionado. Conectores acompanham as bordas das formas vinculadas. Ctrl+Z/Ctrl+Shift+Z: desfazer/refazer; Ctrl+D: duplicar seleção; Shift+clique: seleção múltipla; espaço+arrastar ou botão do meio: mover câmera; roda: zoom no cursor; setas: deslocar seleção (Shift move dez unidades). Atalhos não substituem a edição normal de campos de texto. Há ações visíveis para ferramentas, ordem visual, zoom e enquadramento.

Remover um cartão, vínculo ou prancha não exclui a tarefa oficial. Desfazer desenho não apaga tarefas já criadas. Uma tarefa removida é identificada como indisponível. Títulos/estados vêm da tarefa atual; notas/decisões originais podem preservar seu texto de contexto.

## Aparência do desenho

### Controles de transformação

O Paper usa controles inspirados no Excalidraw, adaptados aos atalhos existentes:

- Quatro alças nos cantos redimensionam um elemento selecionado. Shift ou Ctrl mantém sua proporção; Alt mantém o centro. As combinações funcionam juntas e em formas giradas.
- A alça circular acima da seleção gira formas, notas, texto, imagens e desenho livre. Shift encaixa o ângulo em passos de 15°. O painel permite girar ±15° e zerar a rotação. Alt+seta esquerda/direita gira 15°; Alt+Shift+seta gira 1°.
- Shift ao criar retângulos/elipses produz quadrados/círculos, ao criar/redimensionar setas trava direções em passos de 45°, e ao arrastar uma seleção restringe o movimento a um eixo.
- P ativa Lápis; B ativa Caneta. Caneta usa curva contínua suave com uma passada; Lápis preserva segmentos e irregularidade. Linha limpa continua disponível no estilo. Não há simulação de pressão.
- Ctrl+A seleciona tudo; Ctrl+D duplica; Ctrl+Z/Ctrl+Shift+Z desfaz/refaz; Ctrl+Shift+[/] envia para trás/frente; Ctrl+ +/− controla zoom; Ctrl+0 restaura 100%. Atalhos não interceptam campos ou texto em edição.

O painel Atalhos e controles mostra as combinações no próprio canvas. Rotação usa `angle` em radianos, zero por padrão em documentos antigos, validado no backend. Forma, rótulo e marca-texto giram juntos; conectores acompanham as bordas giradas. Exportação PNG calcula limites a partir dos quatro cantos transformados. Setas continuam sendo ajustadas pelos seus pontos. Redimensionamento e rotação por alças são individuais; a seleção múltipla conserva mover, duplicar e girar cada elemento pelo teclado.

O canvas e a exportação PNG têm fundo branco em todos os temas; ferramentas e painéis acompanham o tema do aplicativo. As cores do desenho usam uma paleta fixa legível sobre branco.

No painel de estilo, escolha Lápis, Caneta ou Linha limpa. Novos desenhos começam com Lápis. A escolha altera os elementos selecionados e pode ser desfeita. Elementos de quadros antigos mantêm Linha limpa até alteração explícita.

Rough.js gera paths SVG locais com uma semente derivada do ID de cada elemento. Mover a câmera não regenera a geometria; mover uma forma mantém seu traçado. A exportação usa os mesmos paths exibidos, sem dependência de CDN. Lápis e caneta são estilos visuais, sem simulação de pressão de mesa digitalizadora.

## Escrita manuscrita e marca-texto

Selecione texto, nota ou forma com texto para escolher a fonte Manuscrita ou Simples e aplicar marca-texto amarelo, verde, rosa ou azul. Sem marcação remove o destaque. A marcação acompanha todas as linhas visíveis do texto do elemento, incluindo quebra de linha; o editor de texto rico permite selecionar trechos individuais para aplicar marcação e formatação.

Novos elementos usam Caveat, fonte livre SIL OFL 1.1, empacotada localmente. Quadros antigos mantêm fonte simples e nenhuma marcação. A licença acompanha o aplicativo em public/licenses/Caveat-OFL.txt. A medição usa a fonte carregada para ajustar quebra por largura. Notas e formas pequenas recortam seus rótulos; textos livres crescem em altura para exibir todas as linhas.

O marca-texto é gerado pelo Rough.js atrás das letras e mantém sua geometria durante pan/zoom. A exportação incorpora a fonte no SVG intermediário, preservando a escrita no PNG sem acesso à internet. Fonte e marcação são salvas no cofre e participam de desfazer/refazer.

Validação desta extensão: 115 testes frontend e 12 testes Rust do board passaram; escrita com acentos e marcação multilinha conferidas no canvas e no PNG real.

## Texto livre no canvas

Um clique seleciona o elemento; dois cliques reabrem a edição mesmo quando a captura de ponteiro redireciona o evento ao canvas. A seleção também oferece o botão Editar texto, e Enter abre o editor. Com a ferramenta Texto ativa, clicar em um texto ou forma editável reabre seu conteúdo em vez de criar outro elemento. Gestos de pan e edição dentro do próprio campo não são interceptados pelo clique duplo do canvas.

Com a ferramenta Texto, clique para escrever diretamente no local escolhido. Dois cliques ou Enter na seleção reabrem a edição. Enter cria novas linhas; Ctrl+Enter ou clicar fora confirma; Escape cancela o rascunho. Enquanto escreve, os atalhos do canvas não interceptam a digitação.

Novos textos usam largura automática, acompanhando cada linha escrita sem uma caixa fixa. Desative Largura automática ou arraste a largura da seleção para controlar a quebra de linha. A altura cresce conforme o conteúdo, preservando espaços e linhas vazias. Fonte e marca-texto continuam aplicáveis; o PNG inclui o texto completo. Títulos dentro de notas/formas mantêm o editor de cartão.

Validação desta correção: 121 testes frontend passaram na suíte completa; 21 testes focados passaram após o ajuste visual final; 14 testes Rust do board passaram. Edição direta e PNG multilinha conferidos com dados sintéticos.

## Editor de texto rico

Texto usa fundo transparente, inclusive durante a edição. No painel de estilo, Fundo do texto permite Transparente, Retângulo ou Círculo/oval; fundos usam o mesmo traço Rough.js e a cor do elemento. Escolher uma forma desativa largura automática e permite redimensionar sua caixa sem perder a altura. Alinhamento horizontal (Esquerda/Centro/Direita) e vertical (Topo/Meio/Base) também se aplicam aos rótulos de notas e formas. Centro + Meio centraliza o texto nos dois eixos. O alinhamento por trecho/parágrafo continua disponível na barra do editor rico. Fundo e alinhamento são salvos, exportados e participam de desfazer/refazer; documentos antigos mantêm os padrões anteriores.

Dois cliques no bloco abrem uma barra de formatação sobre o texto. Selecione uma palavra ou trecho para alterar fonte, tamanho (8 a 72), cor, negrito, itálico, sublinhado e marca-texto. Alinhamento e listas são aplicados aos parágrafos. Sem seleção, a escolha define o estilo da próxima digitação. Desfazer/refazer funciona dentro do editor; Concluir, Ctrl+Enter ou clicar no canvas confirma; Escape cancela.

Tiptap já existente nas notas é reutilizado. O cofre recebe um documento tipado de parágrafos e trechos, sem HTML arbitrário, com cores e tamanhos validados. O texto simples permanece como espelho para busca, lista de elementos e compatibilidade. Blocos antigos são convertidos ao editar. A exportação SVG/PNG renderiza os estilos por trecho e inclui a fonte local.

Limites: até 1.000 parágrafos, 10.000 trechos e 100.000 bytes UTF-8 de texto por documento rico, além do limite total do board. Validação desta extensão: 133 testes frontend e 17 testes Rust do board passaram; seleção parcial e PNG com fontes/cores/tamanhos mistos conferidos em fixture sintética.

## Salvamento e recuperação

Alterações confirmadas são agrupadas por 800 ms de inatividade, com uma espera máxima inicial de cinco segundos. Gravações ficam em fila e respostas atrasadas preservam edições posteriores. Pan, zoom e seleção não escrevem no cofre.

Texto em edição é confirmado ao sair do campo ou antes da saída coordenada. Um gesto ainda não concluído pode ser cancelado; Escape cancela uma edição de texto deliberadamente.

Ao sair da página, bloquear o cofre ou usar Sair no tray, o app tenta concluir o salvamento. Se falhar, mantém o rascunho e pede uma decisão explícita antes de descartá-lo. Fechar a janela com o cofre aberto continua minimizando o app, preservando seu funcionamento residente.

Erro de escrita pausa autosave. Tentar novamente preserva o conteúdo. Recarregar exige confirmação de descarte e atualiza o cofre antes de buscar a versão salva. Se a recarga falhar, o conteúdo em memória continua disponível. Morte do processo, falha do sistema ou perda de energia antes do salvamento ainda podem perder mudanças não confirmadas; não existe diário durável de rascunhos nesta versão.

## Limites iniciais

- Até 2.000 elementos e 20 MiB de dados serializados por prancha.
- Imagem PNG/JPEG/WebP: até 5 MiB por arquivo, 8.192 pixels por lado e 64 megapixels. Cabeçalho/dimensões e decodificação são verificados antes da inclusão pelo editor.
- PNG exportado: até 8.192 pixels por lado e 64 megapixels; desenhos extensos são reduzidos para caber nesse limite. O backend limita o arquivo exportado a 64 MiB.
- Zoom de 10% a 400%; coordenadas finitas limitadas no backend para evitar cenas corrompidas.
- Histórico local: até 100 estados e orçamento conservador de 20 MiB; estados antigos são descartados. Reabrir uma prancha não restaura histórico de undo.
- Traços limitados a 2.000 pontos pelo editor. Não há biblioteca de componentes frontend ou prototipação interativa nesta versão; wireframes podem ser esboçados com as ferramentas básicas.

O espaço navegável é amplo, mas armazenamento e memória continuam limitados. Esses limites são proteções da primeira versão, não resultados de benchmark de capacidade máxima.

## Arquitetura implementada

- Editor SVG/Vue em `src/features/boards`, sem novo runtime ou dependência gráfica. Ferramentas, geometria e histórico são testados separadamente.
- Página carregada por rota lazy `/app/boards`; store Pinia e serviço Tauri próprios.
- Seção `boards` versionada no documento criptografado; cofres sem essa seção abrem com lista vazia.
- Backend valida revisões, IDs, referências, tipos, coordenadas e limites de payload.
- Criação de tarefa e vínculo usa um único commit com identificador de operação, evitando duplicação em retry.
- Tarefas vinculadas e checklist são consultados pelos IDs oficiais. Não existe uma segunda implementação de tarefa no canvas.
- Mutação do board realiza leitura e commit sob o mesmo mutex do cofre. Todas as escritas existentes passam a comparar `metadata.revision`, rejeitando snapshots obsoletos.
- Escrita do cofre usa arquivo temporário criptografado, sincronização e substituição final; Windows usa substituição nativa com write-through. Header e fingerprint são atualizados após sucesso.
- Cópias de segurança existentes continuam preservadas; o recurso não introduz exclusão automática. Uso intenso de imagens aumenta custo de escrita e tamanho das cópias; retenção e persistência incremental continuam trabalho futuro.

## Validação

Testes cobrem gestos, câmera, conectores, imagens, texto, histórico, autosave, respostas atrasadas, reset, falhas, navegação, exportação, revisões do cofre, conflitos externos e criação/vínculo de tarefa. Há uma fixture de desenvolvimento em `tests/ui/boards-fixture.html` com backend em memória e conteúdo exclusivamente sintético, não incluída no build de produção.

Validação em 13/10/2026: 108 testes frontend passaram na suíte completa; a correção adicional de normalização do autosave passou nos 10 testes do store. Os 9 testes Rust de boards passaram, incluindo 3 novos testes dos estilos; build frontend, diagnóstico Tauri e empacotamento Windows concluídos. A janela nativa foi reaberta com a rota de Pranchas acessível no cofre existente.

Conferência visual usa essa fixture para validar canvas livre, formas e conectores, edição, vínculo e PNG sem alterar o cofre do usuário. Testes Rust validam o armazenamento e comandos reais separadamente. Benchmark de cenas grandes e acessibilidade com leitores de tela permanecem sem validação conclusiva.

### Consistência do marca-texto

O editor usa uma imagem SVG de pincel gerada pelo Rough.js como fundo de cada trecho marcado; o canvas e o PNG usam os mesmos caminhos normalizados, com semente estável por elemento. Nenhum fundo retangular CSS é usado para representar a marcação. Palavras consecutivas com a mesma marcação formam uma faixa contínua na exportação. Testes verificam a igualdade dos paths entre edição e SVG, remoção da marcação e continuidade da frase.
