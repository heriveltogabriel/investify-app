#!/bin/bash

# Script de configuração automatizada para o Investify no Servidor Linux (Oracle Linux / Ubuntu)
# Para rodar:
# 1. Torne o script executável: chmod +x setup_investify.sh
# 2. Execute o script: sudo ./setup_investify.sh

set -e # Aborta em caso de qualquer erro

TARGET_DIR="/opt/investify-app"
SERVICE_FILE="/etc/systemd/system/investify.service"

echo "=================================================="
echo " Iniciando Instalação/Configuração do Investify "
echo "=================================================="
echo ""

# 1. Detectar o Gerenciador de Pacotes do Sistema
if command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    echo "--> Sistema baseado em RHEL/Oracle Linux detectado (dnf)."
elif command -v apt &> /dev/null; then
    PKG_MANAGER="apt"
    echo "--> Sistema baseado em Debian/Ubuntu detectado (apt)."
else
    echo "Erro: Gerenciador de pacotes não suportado (apenas dnf ou apt são suportados)."
    exit 1
fi

# 2. Configurar arquivo de Swap (recomendado para instâncias Always Free com 1GB RAM)
echo "--> Verificando Memória Swap..."
if ! swapon --show | grep -q '/swapfile'; then
    if [ -f /swapfile ]; then
        echo "Ativando swap existente..."
        sudo swapon /swapfile
    else
        echo "Criando swap file de 2GB..."
        sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        if ! grep -q '/swapfile' /etc/fstab; then
            echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
        fi
        echo "Swap de 2GB criada e ativada."
    fi
else
    echo "Swap já está ativa."
fi

# 3. Instalar Dependências do Sistema
echo "--> Instalando dependências de sistema..."
if [ "$PKG_MANAGER" = "dnf" ]; then
    sudo dnf install -y git python39
    PYTHON_CMD="python3.9"
else
    sudo apt update -y
    sudo apt install -y git python3 python3-pip python3-venv
    PYTHON_CMD="python3"
fi

# 4. Clonar ou Atualizar a Aplicação em /opt
echo "--> Clonando repositório em $TARGET_DIR..."
if [ -d "$TARGET_DIR" ]; then
    echo "Pasta '$TARGET_DIR' já existe. Atualizando código existente..."
    cd "$TARGET_DIR"
    sudo git fetch --all
    sudo git reset --hard origin/main
else
    sudo git clone https://github.com/heriveltogabriel/investify-app.git "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# Configurar permissões do diretório para o usuário atual (geralmente opc ou ubuntu)
CURRENT_USER=$(logname || echo $USER)
sudo chown -R "$CURRENT_USER":"$CURRENT_USER" "$TARGET_DIR"

# 5. Criar e configurar o config.json (se não existir)
if [ ! -f "config.json" ]; then
    echo "--> Criando arquivo de credenciais padrão (config.json)..."
    cat <<EOF > config.json
{
  "username": "admin",
  "password": "change-me-on-first-login"
}
EOF
    echo "Arquivo config.json criado com sucesso."
else
    echo "config.json já existe. Mantendo configurações existentes."
fi

# 6. Criar ambiente virtual Python e instalar dependências
echo "--> Configurando ambiente virtual Python..."
$PYTHON_CMD -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 7. Criar e Configurar o Serviço do Systemd para persistência
echo "--> Configurando serviço do systemd ($SERVICE_FILE)..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Investify Flask Application
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$TARGET_DIR
ExecStart=$TARGET_DIR/venv/bin/python $TARGET_DIR/server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e Iniciar o Serviço
sudo systemctl daemon-reload
sudo systemctl enable investify
sudo systemctl restart investify

# 8. Liberar Portas no Firewall
echo "--> Configurando regras de firewall para a porta 5001..."
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --add-port=5001/tcp --permanent || true
    sudo firewall-cmd --reload || true
    echo "Porta 5001 liberada no firewalld."
elif command -v ufw &> /dev/null; then
    sudo ufw allow 5001/tcp || true
    echo "Porta 5001 liberada no UFW."
else
    echo "Aviso: Nenhum gerenciador de firewall comum detectado (firewalld ou ufw). Certifique-se de liberar a porta 5001 manualmente."
fi

echo ""
echo "=================================================="
echo " Configuração Concluída com Sucesso! "
echo "=================================================="
echo ""
echo "A aplicação já está rodando em segundo plano e iniciará com o boot do servidor."
echo "Você pode verificar o status do serviço rodando:"
echo "  sudo systemctl status investify"
echo ""
echo "As credenciais padrões em config.json são:"
echo "  Usuário: admin"
echo "  Senha: change-me-on-first-login"
echo ""
echo "Link de acesso: http://<IP_DO_SEU_SERVIDOR>:5001"
echo "=================================================="
