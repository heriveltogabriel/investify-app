# Investify

![Dashboard Preview](dashboard_preview.png)

Investify é uma aplicação web completa voltada para o gerenciamento de finanças pessoais, controle de gastos fixos, faturas de cartão de crédito e acompanhamento consolidado de investimentos (CDB, Aportes, Juros/Rendimentos) dos bancos Itaú, Banco do Brasil e C6 Bank.

## Principais Funcionalidades

- **Dashboard Executivo**: KPIs de patrimônio líquido, rendimentos e aportes acumulados com gráficos interativos de alocação de ativos e histórico financeiro.
- **Lançamentos Dinâmicos**: Tela intuitiva para lançamento mensal de despesas fixas, limites/gastos de cartões e atualizações de investimentos.
- **Histórico Consolidado**: Tabela comparativa e detalhada mês a mês de todas as receitas, gastos e evolução das carteiras por banco.
- **Cálculo Dinâmico**: Totalizadores de fim de mês calculados automaticamente de forma reativa no frontend e backend através da fórmula `CDB + Aporte + Juros`.
- **Importação Direta**: Integração com planilhas do Google Sheets para importação rápida de bases legadas.
- **Simulador Avançado (Simulador Pro)**: Projeções de juros compostos com múltiplos cenários configuráveis (inflação, aportes extras recorrentes e metas de independência financeira).

---

## Estrutura de Arquivos

- `server.py`: Servidor backend em Flask (Python) responsável pelas rotas da API, persistência local no arquivo `db.json` e exportação/geração de relatórios profissionais em Excel.
- `parse_data.py`: Script auxiliar de leitura e processamento de arquivos `.xlsx` importados.
- `static/`: Frontend em Vanilla HTML5, CSS3 moderno e JavaScript.
- `db.json`: Banco de dados estruturado em formato JSON.

---

## 💻 Instalação Local

### Requisitos
- Python 3.9+ instalado.
- Git instalado.

### Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/heriveltogabriel/investify-app.git
   cd investify-app
   ```

2. **Criar e Ativar Ambiente Virtual**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # No Windows use: venv\Scripts\activate
   ```

3. **Instalar Dependências**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Executar o Servidor de Desenvolvimento**:
   ```bash
   python3 server.py
   ```
   A aplicação estará disponível em `http://localhost:5001`.

---

## ☁️ Instalação no Servidor Remoto

As etapas a seguir descrevem como implantar a aplicação de maneira persistente e segura em uma instância de servidor na nuvem (como Oracle Linux no OCI ou Ubuntu).

### Opção 1: Instalação Automatizada por Script (Recomendado)

O projeto possui um script de configuração completo (`setup_investify.sh`) que automatiza todos os passos de implantação, incluindo a criação de swap file de 2GB (para servidores de 1GB de RAM), clone do projeto, instalação do Python 3.9, criação do ambiente virtual, instalação de dependências, abertura do firewall e configuração/inicialização automática do serviço Systemd.

Para usá-lo, conecte via SSH em seu servidor remoto e execute:

```bash
# Baixar o script de instalação diretamente do repositório público
curl -O https://raw.githubusercontent.com/heriveltogabriel/investify-app/main/setup_investify.sh

# Dar permissão de execução
chmod +x setup_investify.sh

# Executar como root (sudo)
sudo ./setup_investify.sh
```

A aplicação será configurada e iniciada automaticamente no diretório `/opt/investify-app`.

---

### Opção 2: Instalação Manual Passo a Passo

Caso prefira configurar cada componente individualmente:

#### 1. Criar Memória Virtual (Swap File)
Para evitar travamentos durante compilações ou instalação de dependências em instâncias com recursos de memória limitados (ex: *Always Free* da Oracle Cloud), é recomendável criar e habilitar um arquivo de swap de **2GB**:

```bash
# Criar arquivo vazio
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile

# Configurar e ativar a área de swap
sudo mkswap /swapfile
sudo swapon /swapfile

# Tornar permanente entre reinicializações
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### 2. Instalar Pacotes de Sistema
Instale o Git e a versão adequada do Python:
```bash
sudo dnf install -y git python39
```

### 3. Configurar a Aplicação no Servidor
Recomenda-se instalar o diretório do projeto no caminho `/opt` para garantir conformidade com políticas padrão de permissões (SELinux):

```bash
# Clonar no diretório correto
sudo git clone https://github.com/heriveltogabriel/investify-app.git /opt/investify-app

# Ajustar permissões para o usuário padrão do sistema (opc)
sudo chown -R opc:opc /opt/investify-app

# Criar ambiente virtual python
cd /opt/investify-app
python3.9 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configurar Serviço do Systemd
Crie o arquivo de serviço para que a aplicação Flask inicialize automaticamente com o sistema e seja reiniciada em caso de falhas.

```bash
sudo tee /etc/systemd/system/investify.service << 'EOF'
[Unit]
Description=Investify Flask Application
After=network.target

[Service]
User=opc
WorkingDirectory=/opt/investify-app
ExecStart=/opt/investify-app/venv/bin/python /opt/investify-app/server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

### 5. Ativar e Iniciar o Serviço
```bash
# Atualizar definições do systemd
sudo systemctl daemon-reload

# Habilitar inicialização no boot
sudo systemctl enable investify

# Iniciar o serviço
sudo systemctl start investify

# Verificar o status de execução
sudo systemctl status investify
```

### 6. Liberar Portas no Firewall do Servidor
O Flask escuta na porta **5001**. Para permitir o acesso externo, libere a porta no utilitário de firewall do Oracle Linux:

```bash
sudo firewall-cmd --add-port=5001/tcp --permanent
sudo firewall-cmd --reload
```
*Nota: Não se esqueça de adicionar a porta 5001 nas regras de entrada da Lista de Segurança (Security List) na interface web da Oracle Cloud Console.*

---

## 🔄 Como Atualizar e Implantar Alterações (Deploy Rápido)

Sempre que realizar mudanças no código local e subir para o GitHub:

1. Acesse o servidor remoto por SSH:
   ```bash
   ssh -i ssh/ssh-key-2026-05-26.key opc@<IP-DO-SERVIDOR-REMOTO>
   ```

2. Atualize o repositório e reinicie o serviço systemd:
   ```bash
   cd /opt/investify-app
   git pull
   sudo systemctl restart investify
   ```

3. Verifique se o serviço subiu perfeitamente:
   ```bash
   sudo systemctl status investify
   ```
