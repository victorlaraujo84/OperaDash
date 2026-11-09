# Login próprio e acesso por cliente

O portal usa conta e senha próprias. Uma sessão válida é necessária para carregar o painel e consultar arquivos. O administrador inicial é criado por configuração do servidor. O administrador cadastra clientes e contas, desativa acessos, redefine senhas e seleciona o cliente antes de gerenciar suas fontes. Contas de cliente consultam apenas a própria organização e trocam a senha inicial no primeiro acesso.

1. Criar a API de sessão, administração e arquivos em Node, com SQLite persistente no Docker. Vincular cada arquivo ao identificador do cliente e verificar a permissão em cada requisição.
2. Integrar login e administração ao portal. Reutilizar os importadores existentes com um armazenamento remoto por cliente. Manter o armazenamento IndexedDB para o modo de extensão e exigir reimportação explícita dos arquivos locais no portal.
3. Testar criação e revogação de contas, primeiro acesso, leitura sem sessão, leitura cruzada e escrita por conta de consulta. Validar compilação, execução e persistência.
