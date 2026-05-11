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

# Build do frontend React
RUN npm run build:client

# Porta do servidor
EXPOSE 3000

# Inicia o servidor com tsx (TypeScript direto)
CMD ["npx", "tsx", "server/src/index.ts"]
