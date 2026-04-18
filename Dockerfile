FROM node:18-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY app/package.json ./
RUN npm install --production

COPY app/ ./

EXPOSE 3001

CMD ["node", "server.js"]
