FROM node:20-alpine

WORKDIR /app

ARG INKUBATOR_RELEASE_TAG=""
ARG INKUBATOR_IMAGE=""

ENV NODE_ENV=production
ENV PORT=8080
ENV INKUBATOR_DATA_DIR=/data
ENV INKUBATOR_RELEASE_TAG=${INKUBATOR_RELEASE_TAG}
ENV INKUBATOR_IMAGE=${INKUBATOR_IMAGE}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app ./app
COPY lib ./lib
COPY server ./server

VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server/docker-server.js"]
