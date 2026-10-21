# Entrega — Post-its adaptativos

## Arquivos desta evolução

Backend:
- src-tauri/src/postits.rs — contrato, migração compatível, comandos autenticados por janela/cofre, planejamento das janelas, arraste e apresentação temporária.
- src-tauri/src/postit_layout.rs — modos, dimensões, ancoragem e limites.
- src-tauri/src/postit_groups.rs — pilhas com revisão e mutação atômica.
- src-tauri/src/lib.rs — registro dos novos comandos.

Frontend:
- src/shared/types/postit.ts — contratos opcionais compatíveis.
- src/shared/lib/postits/postit.service.ts — fronteira Tauri.
- src/features/postits/components/PostitNote.vue — três modos, prévia, teclado, edição e redimensionamento.
- O antigo PostitModeControls.vue foi removido; apresentação segue os estados de interação.
- src/features/postits/components/PostitWindow.vue — uma janela por nota/pilha, montagem sob demanda, geometria temporária.
- src/features/postits/composables/usePostitDraft.ts — autosave serializado, revisão, tratamento de conflito e preservação de rascunhos.
- src/pages/postits/PostitsPage.vue — criação com foco/autosave, seleção múltipla, pilhas e busca.
- src/features/help/components/HelpPostitPreview.vue — demonstração compatível com o novo contrato.
- src/locales/pt-BR.json e src/locales/en.json — controles e tutorial atualizado.

Validação e documentação:
- src/features/postits/components/Postits.spec.ts
- src/features/postits/components/PostitWindow.spec.ts
- tests/ui/postits-fixture.html
- docs/DATA_MODEL.md
- docs/POSTITS_PROPOSAL.md
- docs/POSTITS_ADAPTIVE_DELIVERY.md
- docs/assets/praxis-postits.png
- README.md

As alterações de Configurações, Papéis e documentação já presentes no início desta tarefa foram preservadas.

## Migração

A leitura antiga permanece sem escrita. collapsed=true vira Micro e collapsed=false vira Expandido em memória. Campos novos opcionais são persistidos junto da próxima alteração. Todas as notas ficam pequenas em repouso; as antigas preferências de modo são preservadas apenas por compatibilidade e ignoradas na apresentação. Texto, cores, revisões e posição não são descartados. As notas permanecem no cofre criptografado existente; posições continuam nas configurações locais. Pilhas usam chaves próprias, sem substituir as chaves dos membros.

## Validação

- Suíte frontend completa: 541 aprovados e 1 ignorado, antes dos últimos testes adicionais.
- Suíte Rust completa: 136 aprovados, incluindo a correção de limites da tela.
- Verificação final direcionada: 22 aprovados, incluindo ajuda e novas interações.
- Build frontend e build Tauri de produção sem instalador executados.
- Testes de autosave concorrente, conflito de texto, navegação por teclado, prévia de 300 ms, fixação de modo, Escape, agrupamento, busca e 60 notas sem editores montados.
- Prévia no navegador: seleção múltipla, pilha nomeada e organização com modos individuais.
- Desktop: restauração de nota antiga, Micro, Compacto e leitura Expandida; Escape fecha a leitura, Enter abre o editor e Escape conclui e restaura Micro. O conteúdo do usuário foi preservado. Aplicativo atualizado deixado aberto em Post-its.

## Limites conhecidos

- Permanece o limite configurável de 1–3 janelas nativas; uma pilha conta como uma.
- Layout com múltiplos monitores e fatores de escala diferentes requer validação adicional em hardware real.
- O teste de 60 notas confirma renderização sob demanda e busca; não é um benchmark de CPU/memória.
- Conflito real de texto preserva o rascunho e exige resolução explícita, sem sobrescrever a outra edição. A ação “Descartar rascunho e recarregar” permite retomar a versão atual somente por decisão do usuário.
