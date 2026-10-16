# Papers do Praxis

## Papers

Paper é o conceito do canvas livre anteriormente chamado de Board/quadro, com fundo configurável e ferramentas de escrita, formas, desenho, imagens e exportação. Existe uma única biblioteca Papers com todos os documentos antigos e novos. No editor de uma tarefa, junto às suas anotações, é possível criar um Paper, anexar um existente, abrir ou remover apenas o vínculo. Lembretes usam esse mesmo editor de tarefa.

Um Paper pode ser vinculado a várias tarefas. Seus contextos aparecem no canvas e permitem abrir a tarefa com seu checklist, inclusive arquivada. As alterações do formulário são salvas antes de abrir um Paper. Falhas de salvamento impedem a navegação e preservam o rascunho.

Os documentos continuam na seção criptografada `boards`. O campo legado `kind: board|paper` é mantido apenas por compatibilidade e não separa bibliotecas ou funcionalidades. Todos os documentos, inclusive sem tipo, podem ser anexados às tarefas. A rota antiga `/app/boards` redireciona para `/app/papers` preservando parâmetros de contexto. A seção `paperLinks` armazena referências entre tarefa e Paper. Criar e anexar um Paper ocorre em um único commit com identificador de operação para tentativas seguras. Abrir cofres antigos não cria essas seções. Excluir uma tarefa remove seus vínculos e preserva os Papers; excluir um Paper remove seus vínculos e preserva as tarefas. Duplicar um Paper copia o canvas sem copiar seus vínculos de contexto.

Anotações nesta versão pertencem às tarefas; o Paper é um documento separado vinculado a elas, sem inserir conteúdo visual no HTML das notas.

Quadros oferecem um canvas livre para desenhos simples, fluxos, sketches e referências visuais. Refinamentos são um uso possível, sem impor uma estrutura ou modelo. O conteúdo acompanha o cofre `.praxis` criptografado. Não há serviço de colaboração em tempo real.

## Uso

### Experiência de papel digital

A experiência principal usa o Concepts como referência de desenho e exploração de ideias. Ao abrir um Paper, o canvas ocupa a janela do aplicativo e a navegação geral é recolhida; Voltar ao Praxis restaura a navegação. Uma roda compacta oferece lápis, caneta, seleção, mão, texto e nota. Formas, conectores e imagens ficam na gaveta de ferramentas adicionais. Papers em branco começam com o lápis; lápis e caneta permanecem ativos entre traços.

O centro da roda abre os ajustes de traço: espessura de 0,5 a 32 pixels do espaço da cena, opacidade de 5% a 100% e cor livre. As escolhas configuram novos elementos ou modificam a seleção, com desfazer/refazer. Cor e opacidade também acompanham a escrita e a exportação; documentos antigos conservam as medidas anteriores quando a espessura não está definida. O backend valida os valores e as cores hexadecimais.

A galeria reúne os Papers por nome e quantidade real de elementos. Abrir a galeria durante um desenho não desmonta o canvas nem descarta seu rascunho. Cabeçalho, contextos de tarefas e detalhes ficam sobrepostos e compactos, liberando o papel. A seleção oferece ações de edição, estilo, duplicação e remoção. O modo sem distrações continua recolhendo inclusive a roda de ferramentas. Esta reconstrução implementa a experiência de navegação e desenho com as ferramentas existentes; camadas nomeadas, pressão de caneta e importação de PDF não fazem parte dessa implementação.

O botão Modo sem distrações abre o Paper em tela cheia no desktop e ocupa toda a janela com o canvas, sem navegação, título, biblioteca, detalhes ou barras de ferramentas. Mostrar ferramentas reexibe apenas os controles do desenho. Sair do modo sem distrações ou Esc retorna à visualização normal; Esc durante edição/gesto cancela essa interação antes de sair. O canvas e sua câmera não são recriados, e notas abertas no painel de tarefa são apenas ocultadas, preservando seu rascunho. A janela retorna ao estado de tela cheia anterior ao entrar no modo. Erros de salvamento continuam visíveis.

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

O menu Fundo configura cada Paper: liso, quadriculado, pautado ou pontilhado, em aparência clara ou escura, independentemente do tema do aplicativo. A escolha é persistida e incluída na exportação PNG. Documentos antigos usam papel branco liso sem alteração automática do arquivo. As guias acompanham o deslocamento e zoom da câmera. A paleta padrão adapta o contraste no modo escuro apenas na renderização, preservando cores personalizadas e os dados dos elementos.

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

## Materiais de escrita

A paleta Instrumentos reúne Lápis e Grafite no grupo Lápis, e Caneta, Tinteiro e Nanquim no grupo Canetas. Abrir a paleta não troca a ferramenta; escolher uma opção fecha a paleta. Os ajustes de cor, espessura e opacidade ficam separados dos materiais e dos estilos de contorno de formas. No modo desenho, ajustes configuram os próximos riscos; apenas o modo seleção altera elementos existentes. Painéis são fechados ao trocar de ferramenta, começar a editar texto, pressionar Escape, clicar fora ou voltar ao canvas. Paleta, ajustes e propriedades não ficam abertos simultaneamente. Menus de fundo, contextos e ações do Paper fecham ao interagir fora deles.

Nanquim · esboço usa ponta redonda fina, tinta opaca e leve variação de espessura com pressão e distância percorrida. O padrão é 1,6 px; cor, espessura e opacidade continuam ajustáveis. O mesmo caminho vetorial acompanha o gesto e permanece no canvas e no PNG, sem carregar o motor de pincéis raster. A opção persistida é `drawBrush: ink`, validada pelo Rust. Durante o desenho, painéis de propriedades e ações da seleção ficam ocultos; voltam ao selecionar os elementos com V.

Lápis e grafite têm depósito de pigmento variável com a pressão, fibras com pequenos desvios e lacunas irregulares. A textura usa a distância percorrida e uma semente por elemento, mantendo o resultado estável durante o gesto, ao mover o desenho e na exportação. As formas com estilo lápis também usam curvas e vértices menos regulares; a posição lógica e as âncoras dos conectores permanecem intactas.

A escolha de ferramentas oferece caneta padrão, lápis, grafite e caneta-tinteiro. Lápis e grafite usam fibras vetoriais finas com transparência e pequenas lacunas, simulando a textura do papel. O tinteiro usa um contorno preenchido que varia conforme a direção de uma ponta inclinada e a pressão registrada. Os padrões são discretos: lápis 1,2 px, caneta 1,6 px, grafite 1,8 px e tinteiro 2,4 px. A espessura permanece ajustável.

Grafite e tinteiro usam o mesmo renderizador vetorial durante o gesto e após soltá-lo; não há textura assíncrona substituindo a prévia. O lápis também apresenta sua textura durante o movimento. Eventos de ponteiro agrupados pelo navegador são consumidos antes da atualização visual, preservando pressão e pontos intermediários. A exportação usa os mesmos caminhos SVG. Não há loop de desenho ocioso nem dependência de WebGL para os materiais atuais.

### Compatibilidade com materiais artísticos anteriores

Carvão, marcador, aquarela e spray foram retirados da escolha de ferramentas. Os parágrafos abaixo descrevem apenas o renderizador de compatibilidade dos desenhos antigos, que continuam legíveis e exportáveis sem converter ou apagar traços existentes.

O Paper oferece grafite, carvão, marcador, aquarela e spray, além dos estilos clássicos. Cor, espessura e opacidade continuam nos controles do desenho; canetas compatíveis podem registrar pressão por ponto. Durante o gesto, o canvas mostra um traço vetorial leve. Ao concluir, `p5.brush/standalone`, carregado sob demanda, gera a textura em uma superfície WebGL2 temporária. Não há loop de desenho permanentemente ativo. A aquarela usa o contorno do gesto com pressão; os demais materiais usam os pincéis correspondentes da biblioteca.

Os pontos vetoriais e a pressão permanecem no documento; a imagem de textura é temporária, não um novo anexo no cofre. O renderizador usa uma fila única, até 182 pontos amostrados e uma captura de no máximo 1024 pixels por lado. O cache guarda até 64 texturas dentro de um orçamento de 16 MiB e é liberado ao sair do Paper. Pan, rotação e opacidade reutilizam a textura; mudanças de pontos, cor, espessura ou material exigem nova captura. A exportação incorpora essas imagens ao SVG/PNG. Ampliações extremas podem mostrar o limite de resolução da textura. Sem WebGL2, o traço vetorial continua visível como alternativa simples.

Uma única superfície WebGL2 de 1024 × 1024 permanece compartilhada e aquecida até o aplicativo fechar. Ao sair do Paper, o cache e os buffers de desenho são limpos, removendo o conteúdo visual privado dessa superfície; o contexto gráfico é preservado para evitar reconstrução de shaders. A limpeza ocorre em `onBeforeUnmount`, antes que o próximo canvas agende suas capturas, e invalida trabalhos pendentes do Paper anterior sem cancelar os trabalhos do seguinte.

## Arquitetura implementada

- Editor SVG/Vue em `src/features/boards`, com Rough.js, Rough Notation e materiais artísticos p5.brush carregados sob demanda. Ferramentas, geometria e histórico são testados separadamente.
- Página carregada por rota lazy `/app/boards`; store Pinia e serviço Tauri próprios.
- Seção `boards` versionada no documento criptografado; cofres sem essa seção abrem com lista vazia.
- Backend valida revisões, IDs, referências, tipos, coordenadas e limites de payload.
- Criação de tarefa e vínculo usa um único commit com identificador de operação, evitando duplicação em retry.
- Tarefas vinculadas e checklist são consultados pelos IDs oficiais. Não existe uma segunda implementação de tarefa no canvas.
- Mutação do board realiza leitura e commit sob o mesmo mutex do cofre. Todas as escritas existentes passam a comparar `metadata.revision`, rejeitando snapshots obsoletos.
- Escrita do cofre usa arquivo temporário criptografado, sincronização e substituição final; Windows usa substituição nativa com write-through. Header e fingerprint são atualizados após sucesso.
- Cópias de segurança existentes continuam preservadas; o recurso não introduz exclusão automática. Uso intenso de imagens aumenta custo de escrita e tamanho das cópias; retenção e persistência incremental continuam trabalho futuro.

## Validação

### Propriedades contextuais e organização

O cadeado do cabeçalho bloqueia o Paper inteiro e persiste esse estado no documento. Antes de bloquear, a edição em andamento é concluída e salva. O modo bloqueado permite mover a câmera, zoom, consulta e exportação, mas impede desenho, texto, transformação, atalhos de edição, mudanças de título/fundo, exclusão e criação de tarefa por elemento. O backend também rejeita alterações ao conteúdo bloqueado; desbloquear exige uma operação sem alterar o conteúdo. Falha de salvamento mantém o estado anterior. Papers antigos começam desbloqueados sem escrita durante a leitura. O alfinete da roda tem outra função: manter a ferramenta ativa entre riscos.

Alças de redimensionamento, ajustes de extremidades de setas e rotação aparecem e capturam o ponteiro somente na ferramenta Selecionar. Durante escrita e desenho, o próximo risco pode começar sobre o canto do anterior sem transformar o elemento existente.

O texto livre pode ser ampliado ou reduzido arrastando os cantos: a caixa e os tamanhos de fonte escalam juntos, preservando a relação entre trechos formatados e a âncora oposta, inclusive com rotação. Alt mantém o centro; Ctrl/Cmd ajusta apenas a caixa e a quebra de linhas. O gesto parte sempre do snapshot inicial e gera uma única operação de desfazer. Os limites de fonte existentes (8–72) continuam valendo. Os quatro presets permanecem atalhos, não uma restrição a quatro tamanhos.

O Paper escuro adapta o contraste de todas as cores de texto, inclusive cores personalizadas, sem modificar os valores persistidos. A mesma adaptação vale para o editor, SVG e PNG; voltar ao claro recupera a cor original. Texto manuscrito sem fundo no Paper escuro usa contraste de pelo menos 7:1. Preenchimentos personalizados usam sua cor efetiva como referência com alvo de 4,5:1. Marca-texto preserva a tinta sobre sua faixa clara. As cores de desenhos e contornos permanecem independentes dessa adaptação de texto.

Ao selecionar um elemento, o Paper abre propriedades aplicáveis ao conteúdo: tamanho numérico da fonte (8–72), passos de dois pontos e presets, cor do texto, posição horizontal/vertical, preenchimento, contorno e opacidade. Texto livre também permite largura automática e fundo transparente, retangular ou elíptico. Notas e formas usam o mesmo editor rico do texto livre; a edição preserva a geometria da forma. Os sete efeitos Rough Notation permanecem visíveis no minimenu durante a edição. Fechar as propriedades mantém a seleção; o botão Propriedades reabre o painel.

`fillColor` ausente ou nulo conserva a aparência legada. Valores explícitos aceitam `transparent` ou hexadecimal RGB validado, sem alterar o contorno e os trechos de texto. O backend limita o preenchimento a formas/cartões e ao texto com forma de fundo. Mudar o contorno de uma forma preserva as cores do texto. As propriedades e o preenchimento são persistidos, compartilhados pelo SVG e pela exportação PNG, e participam do histórico de desfazer.

A multisseleção permite alinhar bordas ou centros e distribuir três ou mais elementos com espaçamento igual entre bordas. O cálculo usa limites visuais, inclusive para formas giradas. Setas ficam fora do cálculo: conectores vinculados acompanham os elementos por seus IDs. Tamanhos de fonte e preenchimentos diferentes não são apresentados como um único valor selecionado. Os ajustes não introduzem dependências ou processamento contínuo.

Referências de interação: [Miro — texto](https://help.miro.com/hc/en-us/articles/360017572094-Text), [Miro — formas](https://help.miro.com/hc/en-us/articles/360017730713-Shapes), [tldraw — estilos](https://tldraw.dev/sdk-features/styles), [Concepts — seleção](https://concepts.app/en/manual/selection) e [Excalidraw — propriedades](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata). A implementação conserva as ferramentas e a linguagem visual do Praxis.

Testes cobrem gestos, câmera, conectores, imagens, texto, histórico, autosave, respostas atrasadas, reset, falhas, navegação, exportação, revisões do cofre, conflitos externos e criação/vínculo de tarefa. Há uma fixture de desenvolvimento em `tests/ui/boards-fixture.html` com backend em memória e conteúdo exclusivamente sintético, não incluída no build de produção.

Validação em 13/10/2026: 108 testes frontend passaram na suíte completa; a correção adicional de normalização do autosave passou nos 10 testes do store. Os 9 testes Rust de boards passaram, incluindo 3 novos testes dos estilos; build frontend, diagnóstico Tauri e empacotamento Windows concluídos. A janela nativa foi reaberta com a rota de Pranchas acessível no cofre existente.

Conferência visual usa essa fixture para validar canvas livre, formas e conectores, edição, vínculo e PNG sem alterar o cofre do usuário. Testes Rust validam o armazenamento e comandos reais separadamente. Benchmark de cenas grandes e acessibilidade com leitores de tela permanecem sem validação conclusiva.

### Anotações desenhadas sobre o texto

O painel de texto oferece os sete estilos Rough Notation: sublinhado, caixa, círculo, marca-texto, riscado, cruzado e colchetes. Selecione um trecho no editor para aplicar o efeito apenas à seleção; sem seleção, o efeito vale para o texto inteiro. Os controles permitem remover a anotação e ajustar cor, espessura, distância (inclusive por lado), repetições do traço, lados dos colchetes, linhas separadas e direção do desenho. A animação é opcional, com duração, espera e reprodução manual. A preferência do sistema por movimento reduzido mantém os efeitos estáticos. A exportação SVG/PNG sempre mostra a marcação final completa, mesmo durante uma animação.

### Histórico de edição

Os snapshots isolam geometria, texto rico e opções das anotações. Respostas de salvamento equivalentes, mesmo com campos reordenados e valores padrão preenchidos pelo Rust, preservam o histórico; alterações externas de conteúdo o reiniciam. Criar um texto e concluir sua primeira edição constitui uma única ação, sem caixas vazias ao desfazer. Durante a escrita, apenas o histórico do editor fica visível; concluir retorna o foco ao canvas. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z e Ctrl/Cmd+Y também funcionam nos botões da paleta. Campos de entrada mantêm seus próprios atalhos. Os botões indicam a disponibilidade de cada operação. O limite de memória inclui texto rico e anotações.

### Consistência do marca-texto

Rough Notation é a única opção de marcação de texto no minimenu e no painel lateral. O seletor antigo de marca-texto foi retirado. Documentos com `textHighlight` ou `run.highlight` continuam legíveis: o adaptador de compatibilidade desenha as cores salvas pelo mesmo renderizador Rough Notation, sem alterar o documento durante a leitura. A edição HTML e o SVG exportado compartilham esses caminhos. Aplicar uma anotação nova limpa a marcação legada correspondente, evitando sobreposição de estilos. Os sete tipos de anotação e suas opções de cor, traço e animação continuam disponíveis.

### Miniaturas e novas formas

O preenchimento Pontos foi retirado por custo durante a movimentação. Documentos antigos com `fillStyle: dots` continuam aceitos pelo backend e são desenhados como hachuras, sem migração ou escrita durante a leitura.

O controle de preenchimento oferece amostras clicáveis de Sólido, Hachuras, Cruzadas e Zigue-zague junto à paleta de cores, nas propriedades da seleção e nos ajustes da ferramenta. Cada elemento salva `fillStyle`; multisseleções com valores diferentes não indicam um padrão único. Escolher um padrão em uma forma sem preenchimento ativa uma cor inicial visível, que pode ser trocada na paleta. As alterações compartilham salvamento, histórico e exportação. Sólido recupera o contraste com a cor de fundo; padrões usam o contraste do papel.

O preenchimento de retângulos, elipses, triângulos, hexágonos e fundos de texto usa hachuras diagonais na cor escolhida. Transparente continua sem preenchimento. As linhas têm espessura independente do contorno e espaçamento que limita sua quantidade em formas grandes. A semente mantém a textura estável; canvas, miniaturas e exportações compartilham o resultado. Como o papel aparece entre as hachuras, o texto automático usa o contraste do papel. Notas e cartões conservam seus fundos sólidos.

Os contornos nativos de lápis usam a geometria irregular do RoughJS com o mesmo depósito vetorial de grafite da escrita livre: corpo leve, fibras e pequenas falhas. A caneta usa contorno de tinta com variação sutil de espessura. Isso se aplica a formas, linhas, setas e fundos opcionais de texto; os preenchimentos e a geometria de interação são preservados. O estilo limpo e os enquadramentos tracejados continuam disponíveis. A caneta livre mantém seu gesto suavizado com irregularidade discreta.

A amostragem dos contornos é limitada a 24 passos por curva e as fibras equivalentes são agrupadas em quatro caminhos por contorno de lápis. A semente do elemento mantém o desenho estável ao mover ou reabrir. Canvas, miniaturas e exportação compartilham o mesmo renderizador, sem conversão posterior ao soltar o ponteiro e sem dependências adicionais. A importação experimental com svg2roughjs foi removida.

A biblioteca mostra uma prévia do conteúdo salvo sobre o fundo do Paper. O carregamento acontece conforme os cartões entram na área visível, com duas solicitações simultâneas e cache temporário de até 12 revisões. O comando autenticado `get_board_preview` lê o documento pelo caminho existente do cofre e retorna uma representação compacta; nenhuma miniatura descriptografada é gravada em disco. Ao sair da biblioteca, o cache é liberado.

Para limitar memória e renderização, a prévia amostra até 128 elementos, 128 pontos por traço e 256 caracteres por texto. Imagens compartilham um orçamento de 1 MiB; imagens maiores aparecem como um indicador. Esses limites afetam somente a miniatura. Rough Notation aparece no estado final, sem animação.

O grupo Formas inclui linha reta (atalho L), triângulo e hexágono. Shift restringe a direção da linha e mantém proporções iguais durante a criação das formas. Linhas têm ajustes nas duas extremidades e não se vinculam automaticamente a outros elementos. Triângulos e hexágonos aceitam preenchimento e texto rico, usam a geometria real para seleção e conexões e compartilham exportação e histórico com as demais formas.

### Cenas de apresentação

Na apresentação, o apontador usa um ponto vermelho luminoso. Segurar o botão principal e arrastar deixa um rastro que desaparece progressivamente em 1,1 segundo por trecho, inclusive enquanto o gesto continua. Soltar encerra o gesto; novos gestos não se conectam ao anterior. Trocar de cena, desativar o apontador ou sair limpa a sobreposição. Controles não geram riscos. O rastro não integra o documento, histórico, salvamento ou exportação. O componente anima somente a sobreposição enquanto existem trechos visíveis, com limite de 256 segmentos e sem temporizador ocioso. Referências de comportamento: [Goodnotes — Trail](https://support.goodnotes.com/hc/en-us/articles/7353727934223-Present-Goodnotes-on-an-external-screen) e [PowerPoint Live — manter pressionado para desenhar](https://support.microsoft.com/en-us/teams/meetings/laser-point-or-draw-on-powerpoint-slides-in-microsoft-teams-meetings).

O botão Apresentação abre a sequência de cenas do Paper. Cada cena é um enquadramento independente dos elementos, com nome, posição, dimensões e proporção 16:9, 4:3 ou livre. Arrastar no canvas cria um enquadramento; clicar usa uma região central da câmera atual. Ajustar enquadramento permite movê-lo e redimensioná-lo pelo canto inferior direito. Concluir ou Escape volta ao desenho. As miniaturas usam o mesmo conteúdo SVG do canvas, sem duplicar os desenhos. Excluir uma cena mantém todo o conteúdo do Paper. Miniaturas podem ser reordenadas por arraste ou botões de subir/descer.

Elementos e cenas compartilham o histórico de desfazer/refazer e são publicados atomicamente para o salvamento. Mudanças de câmera e navegação pela apresentação não geram histórico. Documentos antigos têm sequência vazia; respostas equivalentes do salvamento preservam o histórico. O limite é de 100 cenas, e o orçamento de histórico considera os enquadramentos.

Apresentar usa tela cheia quando disponível e uma sobreposição sem distrações como alternativa. A cena é enquadrada inteira, com faixas fora de sua proporção; as ferramentas de edição ficam bloqueadas. Setas, Espaço, Page Up/Down e Home/End navegam; Escape encerra e restaura a câmera anterior. O apontador é temporário e não altera o documento. Transições suaves podem ser desativadas, respeitam movimento reduzido e viram cortes para deslocamentos longos. Papers bloqueados continuam podendo ser apresentados e exportados.

Exportar PDF cria uma página por cena, na ordem definida. O recorte reutiliza o renderizador SVG/PNG, incluindo fontes, fundo, desenhos e estado final de Rough Notation. Cada página incorpora uma imagem JPEG RGB, com resolução mínima alvo de 1920 pixels no maior lado e os limites existentes de 8192 pixels por lado/64 MP. A exportação bloqueia alterações durante a captura, processa as páginas em sequência e limita o PDF a 64 MiB. O texto no PDF é rasterizado; não é selecionável. O comando nativo aceita somente destino absoluto `.pdf` e conteúdo PDF validado. Nenhuma dependência de geração de slides foi adicionada.

## Acabamento das formas

O painel de propriedades oferece material (linha limpa, caneta ou lapis), borda continua/tracejada/pontilhada, irregularidade e curvatura. As hachuras possuem inclinacao (-90 a 90 graus) e espacamento (5 a 24 px), mantendo o limite proporcional de linhas para formas grandes. O preenchimento de pontos continua desativado.

Os ajustes opcionais de sketch sao persistidos por elemento, participam do historico e usam a mesma renderizacao nas miniaturas e exportacoes. O seed continua baseado no id: mover a forma nao redesenha seu acabamento. Bordas com padrao usam paths com stroke, pois contornos de tinta preenchidos nao aceitam dash. Desenho livre mantem seus materiais atuais. O acabamento foi inspirado nos parametros roughConfig de svg2roughjs/RoughJS, sem adicionar dependencia ou importar SVG.
## Borracha de desenho livre

Borracha (E), junto dos instrumentos: apaga parcialmente os tracos de desenho livre sem alterar textos, formas e imagens. Tamanhos de 12, 24 e 48 px de tela, com cursor circular e alcance compensado pelo zoom. O recorte usa a capsula continua percorrida pelo ponteiro, sem saltar trechos em movimentos rapidos. Fragmentos preservam estilos e interpolam pressao; tracos girados sao recortados em coordenadas do Paper. Cada passada produz uma unica entrada de undo/redo; cancelar ou perder captura restaura o estado anterior. Paper bloqueado e apresentacao impedem apagar. Os fragmentos usam o contrato existente de draw e nao exigem migracao.

## Grupos e menu contextual

Selecione elementos com Shift ou selecao por area e use clique direito > Agrupar (Ctrl+G). Clicar em um membro seleciona o grupo inteiro. O conjunto move, redimensiona proporcionalmente e gira pelo mesmo contorno de selecao. Desagrupar (Ctrl+Shift+G) recupera os elementos sem rasterizar ou perder estilos. Grupos sao planos: agrupar conjuntos existentes cria um novo grupo comum.

O menu contextual oferece agrupar/desagrupar, duplicar, trazer para frente, enviar para tras, excluir e undo/redo. Clique direito preserva a multisselecao quando o alvo ja faz parte dela. Escape, clique fora ou executar uma acao fecham o menu; setas, Home e End navegam nas opcoes. Papers bloqueados e apresentacao nao permitem acoes de edicao. Duplicar remapeia os ids de grupos e conectores, mantendo a copia independente. Apagar desenhos com borracha preserva o grupo dos fragmentos restantes.

