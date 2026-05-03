# Stage 1: build the static site
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine

COPY --from=builder /app/out /usr/share/nginx/html

# nginx defaults to port 80 inside the container
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
