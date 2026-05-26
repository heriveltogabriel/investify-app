#!/bin/bash

# Script de configuração para o Investify no Linux (Ubuntu/Debian)
# Para rodar: 
# 1. Torne o script executável: chmod +x setup_investify.sh
# 2. Execute passando seu token do GitHub: ./setup_investify.sh ghp_sua_chave_aqui

set -e # Aborta o script em caso de erros

GITHUB_TOKEN=$1
GITHUB_USER="heriveltogabriel"
REPO_NAME="investify-app"
TARGET_DIR="investify"

# 1. Verificar se o token foi fornecido
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Erro: Você deve fornecer o token de acesso do GitHub como parâmetro."
    echo "Exemplo: ./setup_investify.sh ghp_seuTokenAqui"
    exit 1
fi

echo "=========================================="
echo " Iniciando Instalação do Investify "
echo "=========================================="

# 2. Atualizar pacotes do sistema e instalar dependências
echo "--> Atualizando lista de pacotes do sistema..."
sudo apt update -y

echo "--> Instalando Git, Python 3 e pip..."
sudo apt install -y git python3 python3-pip python3-venv

# 3. Clonar ou atualizar o repositório
if [ -d "$TARGET_DIR" ]; then
    echo "--> Pasta '$TARGET_DIR' já existe. Atualizando código com git pull..."
    cd "$TARGET_DIR"
    git pull
else
    echo "--> Clonando repositório do GitHub..."
    git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# 4. Criar ambiente virtual do Python (venv)
echo "--> Criando ambiente virtual do Python (venv)..."
python3 -m venv venv

# Ativar o ambiente virtual
source venv/bin/activate

# 5. Instalar dependências do Python
echo "--> Instalando dependências do Python..."
pip install --upgrade pip
pip install -r requirements.txt

echo "=========================================="
echo " Configuração concluída com sucesso! "
echo "=========================================="
echo ""
echo "Para rodar a aplicação em primeiro plano (para testes):"
echo "  cd $TARGET_DIR"
echo "  source venv/bin/activate"
echo "  python3 server.py"
echo ""
echo "Para rodar em segundo plano (background):"
echo "  nohup python3 server.py > server.log 2>&1 &"
echo "  (Você poderá fechar o terminal e a aplicação continuará rodando na porta 5001)"
echo ""
