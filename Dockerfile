FROM node:lts-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json .
RUN npm install --omit=dev

COPY tsconfig.json .
COPY tsconfig.build.json .
COPY src ./src
RUN npm install typescript && ./node_modules/.bin/tsc
COPY src/email/templates/ dist/email/templates/

FROM node:lts-alpine AS runtime

WORKDIR /app
COPY --from=builder /app .
RUN rm -rf /app/src

CMD [ "npm", "start" ]