FROM node:20-alpine AS build
WORKDIR /app
# Feature flags are baked into the bundle at build time. VITE_API_URL is
# deliberately NOT set: production without it means same-origin "/api",
# which nginx in this image proxies to the backend.
ARG VITE_FEATURE_DRIVE=false
ENV VITE_FEATURE_DRIVE=$VITE_FEATURE_DRIVE
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:alpine AS production
# Default upstream matches the docker-compose.prod.yml service name;
# override API_UPSTREAM env when running this container standalone.
ENV API_UPSTREAM=http://api:5000
COPY --from=build /app/dist /usr/share/nginx/html
# The image entrypoint envsubsts *.conf.template with the environment
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
