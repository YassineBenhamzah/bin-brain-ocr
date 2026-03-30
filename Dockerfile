FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache poppler-utils
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]