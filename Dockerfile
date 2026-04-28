FROM node:20-alpine

WORKDIR /app

RUN npm install -g pm2

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 4000

CMD ["npm", "start"]