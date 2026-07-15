FROM node:20-alpine

WORKDIR /app

# Copia os arquivos de dependência
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY package*.json ./

# Instala todas as dependências (dev inclusas para usar tsx)
RUN npm run install:all

# Copia o restante do código
COPY . .

# Build do frontend React e do servidor backend
RUN npm run build

# Limpeza das dependências de dev (opcional, para reduzir tamanho)
# RUN cd server && npm prune --production && cd ../client && npm prune --production

# Porta do servidor
EXPOSE 3000

# Inicia o servidor rodando a versão compilada (Javascript) em vez do TSX
CMD ["npm", "start"]
