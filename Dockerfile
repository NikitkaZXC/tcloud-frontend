FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
LABEL org.opencontainers.image.source=https://github.com/NikitkaZXC/tcloud-frontend
LABEL org.opencontainers.image.licenses=MIT
ENV API_UPSTREAM=http://app:8000
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
