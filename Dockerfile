# syntax=docker/dockerfile:1

FROM node:20.10.0-alpine
RUN apk update && \
    apk add --no-cache libreoffice
WORKDIR /aiexaminer-server
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/main"]
EXPOSE 3000
